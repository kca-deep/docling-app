"""
인증 서비스
JWT 토큰 생성, 비밀번호 해싱, 사용자 인증 로직
"""
import logging
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from sqlalchemy.orm import Session

from backend.config.settings import settings
from backend.models.user import User

logger = logging.getLogger(__name__)

# JWT 설정
ALGORITHM = "HS256"


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
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(hours=settings.SESSION_EXPIRE_HOURS)

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
    ) -> Optional[User]:
        """
        사용자 인증

        Args:
            db: 데이터베이스 세션
            username: 사용자명
            password: 평문 비밀번호

        Returns:
            User: 인증 성공 시 사용자 객체, 실패 시 None
        """
        user = db.query(User).filter(User.username == username).first()

        if not user:
            logger.warning(f"Authentication failed: user '{username}' not found")
            return None

        if not user.is_active:
            logger.warning(f"Authentication failed: user '{username}' is inactive")
            return None

        if not self.verify_password(password, user.password_hash):
            logger.warning(f"Authentication failed: invalid password for '{username}'")
            return None

        # 마지막 로그인 시간 업데이트
        user.last_login = datetime.utcnow()
        db.commit()

        logger.info(f"User '{username}' authenticated successfully")
        return user

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
        role: str = "admin"
    ) -> User:
        """
        새 사용자 생성

        Args:
            db: 데이터베이스 세션
            username: 사용자명
            password: 평문 비밀번호
            role: 역할 (기본값: admin)

        Returns:
            User: 생성된 사용자 객체
        """
        password_hash = self.get_password_hash(password)
        user = User(
            username=username,
            password_hash=password_hash,
            role=role,
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"User '{username}' created with role '{role}'")
        return user

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


# 싱글톤 인스턴스
auth_service = AuthService()
