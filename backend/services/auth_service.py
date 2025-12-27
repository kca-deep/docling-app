"""
인증 서비스
JWT 토큰 생성, 비밀번호 해싱, 사용자 인증 로직, 회원가입 관리
"""
import logging
import hashlib
import secrets
import re
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Tuple

from jose import JWTError, jwt
from sqlalchemy.orm import Session

from backend.config.settings import settings
from backend.models.user import User, UserStatus, get_default_permissions, get_admin_permissions

logger = logging.getLogger(__name__)

# JWT 설정
ALGORITHM = "HS256"

# 브루트포스 방어 설정
MAX_LOGIN_ATTEMPTS = 5  # 최대 로그인 실패 횟수
LOCKOUT_DURATION_MINUTES = 15  # 계정 잠금 시간 (분)


class AuthenticationError(Exception):
    """인증 관련 예외"""
    def __init__(self, message: str, error_code: str = "AUTH_ERROR"):
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)


class AuthService:
    """인증 서비스 클래스"""

    def _hash_password_with_salt(self, password: str, salt: str) -> str:
        """PBKDF2-SHA256으로 비밀번호 해싱 (salt 포함)"""
        # PBKDF2 with SHA256, 100000 iterations (OWASP 권장)
        dk = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        )
        return dk.hex()

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """비밀번호 검증"""
        try:
            # 저장 형식: salt$hash
            parts = hashed_password.split('$')
            if len(parts) != 2:
                return False
            salt, stored_hash = parts
            computed_hash = self._hash_password_with_salt(plain_password, salt)
            return secrets.compare_digest(computed_hash, stored_hash)
        except Exception as e:
            logger.error(f"Password verification error: {e}")
            return False

    def get_password_hash(self, password: str) -> str:
        """비밀번호 해싱 (PBKDF2-SHA256)"""
        # 32바이트 랜덤 salt 생성
        salt = secrets.token_hex(32)
        password_hash = self._hash_password_with_salt(password, salt)
        # 저장 형식: salt$hash
        return f"{salt}${password_hash}"

    def create_access_token(
        self,
        data: dict,
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """
        JWT 액세스 토큰 생성

        Args:
            data: 토큰에 포함할 데이터 (sub, username, role 등)
            expires_delta: 만료 시간 (None이면 설정값 사용)

        Returns:
            str: JWT 토큰
        """
        to_encode = data.copy()

        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(hours=settings.SESSION_EXPIRE_HOURS)

        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(
            to_encode,
            settings.SESSION_SECRET,
            algorithm=ALGORITHM
        )
        return encoded_jwt

    def decode_token(self, token: str) -> Optional[dict]:
        """
        JWT 토큰 디코딩

        Args:
            token: JWT 토큰

        Returns:
            dict: 디코딩된 페이로드 (실패 시 None)
        """
        try:
            payload = jwt.decode(
                token,
                settings.SESSION_SECRET,
                algorithms=[ALGORITHM]
            )
            return payload
        except JWTError as e:
            logger.warning(f"JWT decode error: {e}")
            return None

    def authenticate_user(
        self,
        db: Session,
        username: str,
        password: str
    ) -> User:
        """
        사용자 인증

        Args:
            db: 데이터베이스 세션
            username: 사용자명
            password: 평문 비밀번호

        Returns:
            User: 인증 성공 시 사용자 객체

        Raises:
            AuthenticationError: 인증 실패 시
        """
        user = db.query(User).filter(User.username == username).first()

        if not user:
            logger.warning(f"Authentication failed: user '{username}' not found")
            raise AuthenticationError("아이디 또는 비밀번호가 올바르지 않습니다.", "INVALID_CREDENTIALS")

        # 계정 잠금 상태 확인 (브루트포스 방어)
        if user.is_locked():
            remaining_seconds = user.get_remaining_lockout_seconds()
            remaining_minutes = (remaining_seconds // 60) + 1
            logger.warning(f"Authentication failed: user '{username}' is locked for {remaining_minutes} more minutes")
            raise AuthenticationError(
                f"계정이 잠겼습니다. {remaining_minutes}분 후에 다시 시도해주세요.",
                "ACCOUNT_LOCKED"
            )

        # 승인 상태 확인
        if user.status == UserStatus.PENDING.value:
            logger.warning(f"Authentication failed: user '{username}' is pending approval")
            raise AuthenticationError("가입 승인 대기 중입니다. 관리자 승인 후 로그인할 수 있습니다.", "PENDING_APPROVAL")

        if user.status == UserStatus.REJECTED.value:
            logger.warning(f"Authentication failed: user '{username}' was rejected")
            raise AuthenticationError("가입이 거절되었습니다. 관리자에게 문의하세요.", "REJECTED")

        if not user.is_active:
            logger.warning(f"Authentication failed: user '{username}' is inactive")
            raise AuthenticationError("비활성화된 계정입니다. 관리자에게 문의하세요.", "INACTIVE")

        if not self.verify_password(password, user.password_hash):
            # 로그인 실패 횟수 증가
            self._increment_failed_attempts(db, user)
            logger.warning(f"Authentication failed: invalid password for '{username}' (attempts: {user.failed_login_attempts})")
            raise AuthenticationError("아이디 또는 비밀번호가 올바르지 않습니다.", "INVALID_CREDENTIALS")

        # 인증 성공: 실패 횟수 초기화
        self._reset_failed_attempts(db, user)

        # 마지막 로그인 시간 업데이트
        user.last_login = datetime.now(timezone.utc)
        db.commit()

        logger.info(f"User '{username}' authenticated successfully")
        return user

    def _increment_failed_attempts(self, db: Session, user: User) -> None:
        """로그인 실패 횟수 증가 및 계정 잠금 처리"""
        user.failed_login_attempts += 1

        if user.failed_login_attempts >= MAX_LOGIN_ATTEMPTS:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
            logger.warning(
                f"User '{user.username}' locked for {LOCKOUT_DURATION_MINUTES} minutes "
                f"after {MAX_LOGIN_ATTEMPTS} failed attempts"
            )

        db.commit()

    def _reset_failed_attempts(self, db: Session, user: User) -> None:
        """로그인 성공 시 실패 횟수 및 잠금 상태 초기화"""
        if user.failed_login_attempts > 0 or user.locked_until is not None:
            user.failed_login_attempts = 0
            user.locked_until = None
            db.commit()

    def get_user_by_id(self, db: Session, user_id: int) -> Optional[User]:
        """사용자 ID로 조회"""
        return db.query(User).filter(User.id == user_id).first()

    def get_user_by_username(self, db: Session, username: str) -> Optional[User]:
        """사용자명으로 조회"""
        return db.query(User).filter(User.username == username).first()

    def create_user(
        self,
        db: Session,
        username: str,
        password: str,
        role: str = "admin",
        email: Optional[str] = None,
        name: Optional[str] = None,
        team_name: Optional[str] = None,
        status: str = UserStatus.APPROVED.value,
        is_active: bool = True
    ) -> User:
        """
        새 사용자 생성 (기존 호환성 유지)

        Args:
            db: 데이터베이스 세션
            username: 사용자명
            password: 평문 비밀번호
            role: 역할 (기본값: admin)
            email: 이메일 (선택)
            name: 실명 (선택)
            team_name: 팀명 (선택)
            status: 승인 상태 (기본값: approved)
            is_active: 활성 상태 (기본값: True)

        Returns:
            User: 생성된 사용자 객체
        """
        password_hash = self.get_password_hash(password)
        user = User(
            username=username,
            email=email or f"{username}@kca.kr",
            password_hash=password_hash,
            name=name or username,
            team_name=team_name,
            role=role,
            status=status,
            is_active=is_active
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"User '{username}' created with role '{role}', status '{status}'")
        return user

    # =========================================
    # 회원가입 관련 메서드
    # =========================================

    def validate_password_strength(self, password: str) -> Tuple[bool, str]:
        """
        비밀번호 강도 검증

        Args:
            password: 검증할 비밀번호

        Returns:
            Tuple[bool, str]: (유효여부, 에러메시지)
        """
        errors = []

        if len(password) < settings.PASSWORD_MIN_LENGTH:
            errors.append(f"비밀번호는 최소 {settings.PASSWORD_MIN_LENGTH}자 이상이어야 합니다.")

        if settings.PASSWORD_REQUIRE_UPPERCASE and not re.search(r'[A-Z]', password):
            errors.append("대문자를 포함해야 합니다.")

        if settings.PASSWORD_REQUIRE_LOWERCASE and not re.search(r'[a-z]', password):
            errors.append("소문자를 포함해야 합니다.")

        if settings.PASSWORD_REQUIRE_DIGIT and not re.search(r'\d', password):
            errors.append("숫자를 포함해야 합니다.")

        if settings.PASSWORD_REQUIRE_SPECIAL and not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            errors.append("특수문자를 포함해야 합니다.")

        if errors:
            return False, " ".join(errors)

        return True, ""

    def validate_email_domain(self, email: str) -> Tuple[bool, str]:
        """
        이메일 도메인 검증

        Args:
            email: 검증할 이메일

        Returns:
            Tuple[bool, str]: (유효여부, 에러메시지)
        """
        if not settings.ALLOWED_EMAIL_DOMAINS:
            return True, ""

        try:
            domain = email.split("@")[1].lower()
        except IndexError:
            return False, "올바른 이메일 형식이 아닙니다."

        allowed_domains = [d.lower() for d in settings.ALLOWED_EMAIL_DOMAINS]

        if domain not in allowed_domains:
            domains_str = ", ".join(f"@{d}" for d in settings.ALLOWED_EMAIL_DOMAINS)
            return False, f"허용된 이메일 도메인이 아닙니다. ({domains_str})"

        return True, ""

    def check_duplicate_username(self, db: Session, username: str) -> bool:
        """
        아이디 중복 체크

        Args:
            db: 데이터베이스 세션
            username: 체크할 아이디

        Returns:
            bool: 중복이면 True
        """
        user = db.query(User).filter(User.username == username).first()
        return user is not None

    def check_duplicate_email(self, db: Session, email: str) -> bool:
        """
        이메일 중복 체크

        Args:
            db: 데이터베이스 세션
            email: 체크할 이메일

        Returns:
            bool: 중복이면 True
        """
        user = db.query(User).filter(User.email == email).first()
        return user is not None

    def get_user_by_email(self, db: Session, email: str) -> Optional[User]:
        """이메일로 사용자 조회"""
        return db.query(User).filter(User.email == email).first()

    def register_user(
        self,
        db: Session,
        username: str,
        email: str,
        password: str,
        name: str,
        team_name: Optional[str] = None
    ) -> User:
        """
        새 사용자 회원가입 (승인 대기 상태로 생성)

        Args:
            db: 데이터베이스 세션
            username: 아이디
            email: 이메일
            password: 비밀번호
            name: 실명
            team_name: 팀명 (선택)

        Returns:
            User: 생성된 사용자 객체

        Raises:
            AuthenticationError: 검증 실패 시
        """
        # 회원가입 활성화 확인
        if not settings.REGISTRATION_ENABLED:
            raise AuthenticationError("회원가입이 비활성화되어 있습니다.", "REGISTRATION_DISABLED")

        # 비밀번호 강도 검증
        is_valid, error_msg = self.validate_password_strength(password)
        if not is_valid:
            raise AuthenticationError(error_msg, "WEAK_PASSWORD")

        # 이메일 도메인 검증
        is_valid, error_msg = self.validate_email_domain(email)
        if not is_valid:
            raise AuthenticationError(error_msg, "INVALID_EMAIL_DOMAIN")

        # 중복 체크
        if self.check_duplicate_username(db, username):
            raise AuthenticationError("이미 사용 중인 아이디입니다.", "DUPLICATE_USERNAME")

        if self.check_duplicate_email(db, email):
            raise AuthenticationError("이미 사용 중인 이메일입니다.", "DUPLICATE_EMAIL")

        # 사용자 생성 (승인 대기 상태)
        password_hash = self.get_password_hash(password)
        user = User(
            username=username,
            email=email,
            password_hash=password_hash,
            name=name,
            team_name=team_name,
            role="user",
            status=UserStatus.PENDING.value,
            is_active=False
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        logger.info(f"New user registered: {username} ({email}) - awaiting approval")
        return user

    def approve_user(
        self,
        db: Session,
        user_id: int,
        admin_id: int
    ) -> User:
        """
        사용자 승인

        Args:
            db: 데이터베이스 세션
            user_id: 승인할 사용자 ID
            admin_id: 승인하는 관리자 ID

        Returns:
            User: 승인된 사용자 객체

        Raises:
            AuthenticationError: 사용자를 찾을 수 없거나 이미 처리된 경우
        """
        user = self.get_user_by_id(db, user_id)
        if not user:
            raise AuthenticationError("사용자를 찾을 수 없습니다.", "USER_NOT_FOUND")

        if user.status != UserStatus.PENDING.value:
            raise AuthenticationError(f"이미 처리된 사용자입니다. (상태: {user.status})", "ALREADY_PROCESSED")

        user.status = UserStatus.APPROVED.value
        user.is_active = True
        user.approved_at = datetime.now(timezone.utc)
        user.approved_by = admin_id

        # 템플릿 사용자(zephyr23)의 권한 복사
        template_user = self.get_user_by_username(db, "zephyr23")
        if template_user and template_user.permissions:
            user.permissions = template_user.permissions.copy()
            logger.info(f"Copied permissions from template user 'zephyr23' to '{user.username}'")
        else:
            # 템플릿 사용자가 없으면 기본 권한 사용
            user.permissions = get_default_permissions()
            logger.warning(f"Template user 'zephyr23' not found, using default permissions for '{user.username}'")

        db.commit()
        db.refresh(user)

        logger.info(f"User '{user.username}' approved by admin ID {admin_id}")
        return user

    def reject_user(
        self,
        db: Session,
        user_id: int,
        admin_id: int,
        reason: Optional[str] = None
    ) -> User:
        """
        사용자 거절

        Args:
            db: 데이터베이스 세션
            user_id: 거절할 사용자 ID
            admin_id: 거절하는 관리자 ID
            reason: 거절 사유 (선택)

        Returns:
            User: 거절된 사용자 객체

        Raises:
            AuthenticationError: 사용자를 찾을 수 없거나 이미 처리된 경우
        """
        user = self.get_user_by_id(db, user_id)
        if not user:
            raise AuthenticationError("사용자를 찾을 수 없습니다.", "USER_NOT_FOUND")

        if user.status != UserStatus.PENDING.value:
            raise AuthenticationError(f"이미 처리된 사용자입니다. (상태: {user.status})", "ALREADY_PROCESSED")

        user.status = UserStatus.REJECTED.value
        user.is_active = False
        user.rejected_reason = reason
        user.approved_by = admin_id  # 거절도 approved_by 필드 재사용

        db.commit()
        db.refresh(user)

        logger.info(f"User '{user.username}' rejected by admin ID {admin_id}. Reason: {reason}")
        return user

    def get_pending_users(self, db: Session) -> List[User]:
        """
        승인 대기 중인 사용자 목록 조회

        Args:
            db: 데이터베이스 세션

        Returns:
            List[User]: 대기 중인 사용자 목록
        """
        return db.query(User).filter(
            User.status == UserStatus.PENDING.value
        ).order_by(User.created_at.desc()).all()

    def get_all_users(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 100,
        status_filter: Optional[str] = None
    ) -> List[User]:
        """
        사용자 목록 조회

        Args:
            db: 데이터베이스 세션
            skip: 건너뛸 개수
            limit: 최대 개수
            status_filter: 상태 필터 (pending, approved, rejected)

        Returns:
            List[User]: 사용자 목록
        """
        query = db.query(User)

        if status_filter:
            query = query.filter(User.status == status_filter)

        return query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()

    def get_shareable_users(
        self,
        db: Session,
        exclude_user_id: Optional[int] = None
    ) -> List[User]:
        """
        공유 가능한 사용자 목록 조회 (컬렉션 공유용)

        Args:
            db: 데이터베이스 세션
            exclude_user_id: 제외할 사용자 ID (현재 로그인 사용자)

        Returns:
            List[User]: 공유 가능한 사용자 목록
        """
        query = db.query(User).filter(
            User.status == UserStatus.APPROVED.value,
            User.is_active == True
        )

        if exclude_user_id:
            query = query.filter(User.id != exclude_user_id)

        return query.order_by(User.name, User.username).all()

    def delete_user(self, db: Session, user_id: int) -> bool:
        """
        사용자 삭제

        Args:
            db: 데이터베이스 세션
            user_id: 삭제할 사용자 ID

        Returns:
            bool: 삭제 성공 여부
        """
        user = self.get_user_by_id(db, user_id)
        if not user:
            return False

        username = user.username
        db.delete(user)
        db.commit()

        logger.info(f"User '{username}' (ID: {user_id}) deleted")
        return True

    def ensure_admin_exists(self, db: Session) -> None:
        """
        기본 관리자 계정 존재 확인 및 생성

        환경변수의 ADMIN_USERNAME, ADMIN_PASSWORD로 기본 관리자 생성
        이미 존재하면 무시
        """
        admin_user = self.get_user_by_username(db, settings.ADMIN_USERNAME)

        if admin_user is None:
            self.create_user(
                db=db,
                username=settings.ADMIN_USERNAME,
                password=settings.ADMIN_PASSWORD,
                role="admin"
            )
            logger.info(f"Default admin user '{settings.ADMIN_USERNAME}' created")
        else:
            logger.debug(f"Admin user '{settings.ADMIN_USERNAME}' already exists")

    # =========================================
    # 권한 관리 메서드
    # =========================================

    def get_user_permissions(self, db: Session, user_id: int) -> Optional[dict]:
        """
        사용자 권한 조회

        Args:
            db: 데이터베이스 세션
            user_id: 사용자 ID

        Returns:
            dict: 사용자 권한 또는 None (사용자 없음)
        """
        user = self.get_user_by_id(db, user_id)
        if not user:
            return None
        return user.get_permissions()

    def update_user_permissions(
        self,
        db: Session,
        user_id: int,
        permissions: dict,
        admin_id: int
    ) -> User:
        """
        사용자 권한 업데이트

        Args:
            db: 데이터베이스 세션
            user_id: 권한을 변경할 사용자 ID
            permissions: 새 권한 설정
            admin_id: 변경을 수행하는 관리자 ID

        Returns:
            User: 업데이트된 사용자 객체

        Raises:
            AuthenticationError: 사용자를 찾을 수 없는 경우
        """
        user = self.get_user_by_id(db, user_id)
        if not user:
            raise AuthenticationError("사용자를 찾을 수 없습니다.", "USER_NOT_FOUND")

        # 관리자 권한은 수정 불가 (역할 기반으로 자동 적용)
        if user.role == "admin":
            raise AuthenticationError(
                "관리자 계정의 권한은 역할에 의해 자동으로 결정됩니다.",
                "ADMIN_PERMISSION_IMMUTABLE"
            )

        # 권한 유효성 검사
        valid_categories = {"selfcheck", "documents", "qdrant", "dify", "chat", "analytics", "excel", "admin"}
        for category in permissions.keys():
            if category not in valid_categories:
                raise AuthenticationError(
                    f"유효하지 않은 권한 카테고리: {category}",
                    "INVALID_PERMISSION_CATEGORY"
                )

        user.permissions = permissions
        db.commit()
        db.refresh(user)

        logger.info(f"User '{user.username}' permissions updated by admin ID {admin_id}")
        return user

    def reset_user_permissions(self, db: Session, user_id: int, admin_id: int) -> User:
        """
        사용자 권한을 기본값으로 초기화

        Args:
            db: 데이터베이스 세션
            user_id: 사용자 ID
            admin_id: 관리자 ID

        Returns:
            User: 업데이트된 사용자 객체
        """
        user = self.get_user_by_id(db, user_id)
        if not user:
            raise AuthenticationError("사용자를 찾을 수 없습니다.", "USER_NOT_FOUND")

        if user.role == "admin":
            raise AuthenticationError(
                "관리자 계정의 권한은 역할에 의해 자동으로 결정됩니다.",
                "ADMIN_PERMISSION_IMMUTABLE"
            )

        user.permissions = get_default_permissions()
        db.commit()
        db.refresh(user)

        logger.info(f"User '{user.username}' permissions reset to default by admin ID {admin_id}")
        return user

    def has_permission(self, user: User, category: str, action: str) -> bool:
        """
        사용자 권한 확인

        Args:
            user: 사용자 객체
            category: 권한 카테고리 (documents, qdrant, dify 등)
            action: 권한 액션 (parse, upload, view 등)

        Returns:
            bool: 권한 보유 여부
        """
        return user.has_permission(category, action)


# 싱글톤 인스턴스
auth_service = AuthService()
