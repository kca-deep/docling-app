"""
RBAC 서비스
DB 기반 역할/권한 조회 및 관리
"""
import logging
from typing import Dict, Any, Optional

from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)

# 모든 권한 목록 (category, action)
ALL_PERMISSIONS = [
    ("chat",      "use"),
    ("chat",      "all_collections"),
    ("selfcheck", "execute"),
    ("selfcheck", "history"),
    ("selfcheck", "feedback"),
    ("documents", "parse"),
    ("documents", "view"),
    ("documents", "delete"),
    ("qdrant",    "upload"),
    ("qdrant",    "collections"),
    ("excel",     "upload"),
    ("dify",      "upload"),
    ("dify",      "config"),
    ("analytics", "view"),
    ("admin",     "users"),
    ("admin",     "system"),
    ("showcase",  "contribute"),
]

# 역할별 기본 권한 (DB 접근 불가 시 fallback)
_ROLE_DEFAULTS: Dict[str, Dict[str, Dict[str, bool]]] = {
    "admin": {cat: {act: True for (c, a) in ALL_PERMISSIONS if c == cat for act in [a]}
              for cat in {c for c, _ in ALL_PERMISSIONS}},
    "operator": {
        "chat":      {"use": False, "all_collections": False},
        "selfcheck": {"execute": False, "history": False, "feedback": False},
        "documents": {"parse": True, "view": True, "delete": True},
        "qdrant":    {"upload": True, "collections": True},
        "excel":     {"upload": True},
        "dify":      {"upload": False, "config": False},
        "analytics": {"view": False},
        "admin":     {"users": False, "system": False},
        "showcase":  {"contribute": True},
    },
    "user": {
        "chat":      {"use": True, "all_collections": False},
        "selfcheck": {"execute": True, "history": True, "feedback": False},
        "documents": {"parse": True, "view": True, "delete": False},
        "qdrant":    {"upload": True, "collections": False},
        "excel":     {"upload": True},
        "dify":      {"upload": True, "config": False},
        "analytics": {"view": False},
        "admin":     {"users": False, "system": False},
        "showcase":  {"contribute": True},
    },
}
# admin fallback 보정: 모든 항목 True
_ROLE_DEFAULTS["admin"] = {
    cat: {act: True for (c, a) in ALL_PERMISSIONS if c == cat for act in [a]}
    for cat in {c for c, _ in ALL_PERMISSIONS}
}


class RbacService:
    """DB 기반 RBAC 권한 관리 서비스"""

    def get_user_permissions(self, db: Session, user_id: int, role: str) -> Dict[str, Any]:
        """
        사용자의 실효 권한 조회 (역할 기본값 + 개인 오버라이드 COALESCE)

        admin은 DB 조회 없이 전체 권한 반환
        """
        if role == "admin":
            return {
                cat: {act: True for (c, a) in ALL_PERMISSIONS if c == cat for act in [a]}
                for cat in {c for c, _ in ALL_PERMISSIONS}
            }

        try:
            rows = db.execute(text("""
                SELECT p.category, p.action, COALESCE(uo.granted, rp.granted) AS effective_granted
                FROM permissions p
                JOIN role_permissions rp ON rp.permission_id = p.id
                JOIN user_roles ur ON ur.role_id = rp.role_id AND ur.user_id = :user_id
                LEFT JOIN user_permission_overrides uo
                    ON uo.permission_id = p.id AND uo.user_id = :user_id
            """), {"user_id": user_id}).fetchall()
        except Exception as e:
            logger.warning(f"DB permission query failed for user {user_id}: {e}")
            return _ROLE_DEFAULTS.get(role, _ROLE_DEFAULTS["user"])

        if not rows:
            # user_roles 엔트리 없으면 role 기반 fallback
            return _ROLE_DEFAULTS.get(role, _ROLE_DEFAULTS["user"])

        result: Dict[str, Dict[str, bool]] = {}
        for category, action, granted in rows:
            result.setdefault(category, {})[action] = bool(granted)
        return result

    def has_permission(self, db: Session, user_id: int, role: str, category: str, action: str) -> bool:
        """특정 권한 보유 여부 확인"""
        if role == "admin":
            return True
        perms = self.get_user_permissions(db, user_id, role)
        return perms.get(category, {}).get(action, False)

    def get_user_role_name(self, db: Session, user_id: int) -> Optional[str]:
        """user_roles 테이블에서 사용자 역할명 조회"""
        try:
            row = db.execute(text("""
                SELECT r.name FROM user_roles ur
                JOIN roles r ON r.id = ur.role_id
                WHERE ur.user_id = :user_id
            """), {"user_id": user_id}).fetchone()
            return row[0] if row else None
        except Exception as e:
            logger.warning(f"Role query failed for user {user_id}: {e}")
            return None

    def ensure_user_role(self, db: Session, user_id: int, role_name: str, assigned_by: Optional[int] = None) -> None:
        """
        user_roles 엔트리 보장 (없으면 생성, 있으면 무시)
        신규 사용자 승인 시 호출
        """
        try:
            existing = db.execute(text(
                "SELECT id FROM user_roles WHERE user_id = :uid"
            ), {"uid": user_id}).fetchone()

            if not existing:
                db.execute(text("""
                    INSERT INTO user_roles (user_id, role_id, assigned_at, assigned_by)
                    VALUES (
                        :user_id,
                        (SELECT id FROM roles WHERE name = :role_name),
                        CURRENT_TIMESTAMP,
                        :assigned_by
                    )
                """), {"user_id": user_id, "role_name": role_name, "assigned_by": assigned_by})
                db.commit()
        except Exception as e:
            logger.error(f"Failed to ensure user role for user {user_id}: {e}")
            db.rollback()

    def set_user_role(self, db: Session, user_id: int, role_name: str, assigned_by: int) -> None:
        """
        사용자 역할 변경
        - user_roles 테이블 upsert
        - users.role 컬럼 동기화
        """
        from backend.models.user import User  # circular import 방지

        role_row = db.execute(text(
            "SELECT id FROM roles WHERE name = :name"
        ), {"name": role_name}).fetchone()
        if not role_row:
            raise ValueError(f"Unknown role: {role_name}")

        role_id = role_row[0]

        # user_roles upsert
        existing = db.execute(text(
            "SELECT id FROM user_roles WHERE user_id = :uid"
        ), {"uid": user_id}).fetchone()

        if existing:
            db.execute(text("""
                UPDATE user_roles
                SET role_id = :role_id, assigned_at = CURRENT_TIMESTAMP, assigned_by = :assigned_by
                WHERE user_id = :user_id
            """), {"role_id": role_id, "assigned_by": assigned_by, "user_id": user_id})
        else:
            db.execute(text("""
                INSERT INTO user_roles (user_id, role_id, assigned_at, assigned_by)
                VALUES (:user_id, :role_id, CURRENT_TIMESTAMP, :assigned_by)
            """), {"user_id": user_id, "role_id": role_id, "assigned_by": assigned_by})

        # users.role 동기화 (빠른 관리자 체크용 cache column)
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.role = role_name

        db.commit()
        logger.info(f"User {user_id} role changed to '{role_name}' by admin {assigned_by}")

    def update_overrides(
        self,
        db: Session,
        user_id: int,
        full_permissions: Dict[str, Dict[str, bool]],
        admin_id: int
    ) -> None:
        """
        사용자 권한 오버라이드 업데이트 (sparse pattern)
        역할 기본값과 다른 항목만 override로 저장, 같으면 삭제
        """
        from backend.models.user import User  # circular import 방지

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User {user_id} not found")

        if user.role == "admin":
            raise ValueError("관리자 계정의 권한은 역할에 의해 자동으로 결정됩니다.")

        role_defaults = _ROLE_DEFAULTS.get(user.role, _ROLE_DEFAULTS["user"])

        for category, actions in full_permissions.items():
            if not isinstance(actions, dict):
                continue
            for action, granted in actions.items():
                default = role_defaults.get(category, {}).get(action)
                if default is None:
                    continue

                if bool(granted) != default:
                    # 역할 기본값과 다름 → override upsert
                    db.execute(text("""
                        INSERT INTO user_permission_overrides
                            (user_id, permission_id, granted, created_at, created_by)
                        VALUES (
                            :user_id,
                            (SELECT id FROM permissions WHERE category = :cat AND action = :act),
                            :granted,
                            CURRENT_TIMESTAMP,
                            :created_by
                        )
                        ON CONFLICT(user_id, permission_id) DO UPDATE SET
                            granted = excluded.granted,
                            created_by = excluded.created_by,
                            created_at = excluded.created_at
                    """), {
                        "user_id": user_id,
                        "cat": category,
                        "act": action,
                        "granted": 1 if granted else 0,
                        "created_by": admin_id,
                    })
                else:
                    # 역할 기본값과 동일 → override 삭제 (sparse pattern)
                    db.execute(text("""
                        DELETE FROM user_permission_overrides
                        WHERE user_id = :user_id
                          AND permission_id = (SELECT id FROM permissions WHERE category = :cat AND action = :act)
                    """), {"user_id": user_id, "cat": category, "act": action})

        db.commit()
        logger.info(f"User {user_id} permission overrides updated by admin {admin_id}")

    def reset_overrides(self, db: Session, user_id: int, admin_id: int) -> None:
        """사용자의 모든 권한 오버라이드 삭제 (역할 기본값으로 복귀)"""
        db.execute(text(
            "DELETE FROM user_permission_overrides WHERE user_id = :user_id"
        ), {"user_id": user_id})
        db.commit()
        logger.info(f"User {user_id} permission overrides reset by admin {admin_id}")

    def get_roles_with_permissions(self, db: Session) -> list:
        """모든 역할과 권한 목록 조회"""
        try:
            rows = db.execute(text("""
                SELECT r.id, r.name, r.description, p.category, p.action, rp.granted
                FROM roles r
                JOIN role_permissions rp ON rp.role_id = r.id
                JOIN permissions p ON p.id = rp.permission_id
                ORDER BY r.id, p.category, p.action
            """)).fetchall()
        except Exception as e:
            logger.error(f"Failed to get roles: {e}")
            return []

        roles: Dict[int, dict] = {}
        for role_id, role_name, role_desc, cat, act, granted in rows:
            if role_id not in roles:
                roles[role_id] = {
                    "id": role_id,
                    "name": role_name,
                    "description": role_desc,
                    "permissions": {}
                }
            roles[role_id]["permissions"].setdefault(cat, {})[act] = bool(granted)

        return list(roles.values())


rbac_service = RbacService()
