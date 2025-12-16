"""
Authentication and Security Unit Tests

Tests for:
- Password hashing and verification
- Account lockout mechanism
- Session secret validation
- Login/logout functionality
"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock

from backend.services.auth_service import AuthService, AuthenticationError
from backend.models.user import User


class TestPasswordHashing:
    """Password hashing and verification tests"""

    def test_password_hashing(self):
        """Test that passwords are hashed correctly"""
        auth_service = AuthService()
        password = "TestPassword123!"
        hashed = auth_service.get_password_hash(password)

        # Hash should be different from original
        assert hashed != password
        # Hash should be a string
        assert isinstance(hashed, str)
        # Hash should contain salt$hash format
        assert "$" in hashed

    def test_password_verification_success(self):
        """Test that correct password verifies successfully"""
        auth_service = AuthService()
        password = "TestPassword123!"
        hashed = auth_service.get_password_hash(password)

        assert auth_service.verify_password(password, hashed) is True

    def test_password_verification_fails_with_wrong_password(self):
        """Test that wrong password fails verification"""
        auth_service = AuthService()
        password = "TestPassword123!"
        wrong_password = "WrongPassword456!"
        hashed = auth_service.get_password_hash(password)

        assert auth_service.verify_password(wrong_password, hashed) is False

    def test_password_hashing_is_unique(self):
        """Test that same password produces different hashes (salt)"""
        auth_service = AuthService()
        password = "TestPassword123!"
        hash1 = auth_service.get_password_hash(password)
        hash2 = auth_service.get_password_hash(password)

        # Hashes should be different due to salt
        assert hash1 != hash2
        # But both should verify correctly
        assert auth_service.verify_password(password, hash1) is True
        assert auth_service.verify_password(password, hash2) is True


class TestAccountLockout:
    """Account lockout mechanism tests"""

    def test_user_not_locked_initially(self, sample_user):
        """Test that new user is not locked"""
        assert sample_user.is_locked() is False

    def test_user_locked_when_locked_until_is_future(self, locked_user):
        """Test that user is locked when locked_until is in the future"""
        assert locked_user.is_locked() is True

    def test_user_unlocked_when_locked_until_is_past(self, test_db):
        """Test that user is unlocked when locked_until has passed"""
        from backend.services.auth_service import auth_service
        from backend.models.user import UserStatus

        user = User(
            username="expiredlock",
            email="expired@kca.kr",
            password_hash=auth_service.get_password_hash("TestPassword123!"),
            role="user",
            status=UserStatus.APPROVED.value,
            is_active=True,
            failed_login_attempts=5,
            locked_until=datetime.now(timezone.utc) - timedelta(minutes=1)  # Past
        )
        test_db.add(user)
        test_db.commit()

        assert user.is_locked() is False

    def test_remaining_lockout_seconds(self, locked_user):
        """Test that remaining lockout seconds is calculated correctly"""
        remaining = locked_user.get_remaining_lockout_seconds()
        # Should be positive and less than 15 minutes (900 seconds)
        assert remaining > 0
        assert remaining <= 900

    def test_remaining_lockout_seconds_zero_when_not_locked(self, sample_user):
        """Test that remaining lockout is 0 for unlocked user"""
        remaining = sample_user.get_remaining_lockout_seconds()
        assert remaining == 0


class TestAuthentication:
    """Authentication flow tests"""

    def test_authenticate_user_success(self, test_db, sample_user):
        """Test successful authentication"""
        from backend.services.auth_service import auth_service

        result = auth_service.authenticate_user(
            test_db, "testuser", "TestPassword123!"
        )

        assert result is not None
        assert result.username == "testuser"

    def test_authenticate_user_wrong_password(self, test_db, sample_user):
        """Test authentication fails with wrong password"""
        from backend.services.auth_service import auth_service

        with pytest.raises(AuthenticationError) as exc_info:
            auth_service.authenticate_user(
                test_db, "testuser", "WrongPassword!"
            )

        assert exc_info.value.error_code == "INVALID_CREDENTIALS"

    def test_authenticate_user_nonexistent(self, test_db):
        """Test authentication fails for non-existent user"""
        from backend.services.auth_service import auth_service

        with pytest.raises(AuthenticationError) as exc_info:
            auth_service.authenticate_user(
                test_db, "nonexistent", "AnyPassword123!"
            )

        assert exc_info.value.error_code == "INVALID_CREDENTIALS"

    def test_authenticate_locked_user_fails(self, test_db, locked_user):
        """Test that locked user cannot authenticate"""
        from backend.services.auth_service import auth_service

        with pytest.raises(AuthenticationError) as exc_info:
            auth_service.authenticate_user(
                test_db, "lockeduser", "TestPassword123!"
            )

        assert exc_info.value.error_code == "ACCOUNT_LOCKED"

    def test_failed_attempts_increment(self, test_db, sample_user):
        """Test that failed login attempts are tracked"""
        from backend.services.auth_service import auth_service

        initial_attempts = sample_user.failed_login_attempts or 0

        # Fail login (expect exception)
        with pytest.raises(AuthenticationError):
            auth_service.authenticate_user(test_db, "testuser", "WrongPassword!")

        test_db.refresh(sample_user)
        assert sample_user.failed_login_attempts == initial_attempts + 1

    def test_successful_login_resets_failed_attempts(self, test_db):
        """Test that successful login resets failed attempts counter"""
        from backend.services.auth_service import auth_service
        from backend.models.user import UserStatus

        # Create user with some failed attempts
        user = User(
            username="resetuser",
            email="reset@kca.kr",
            password_hash=auth_service.get_password_hash("TestPassword123!"),
            role="user",
            status=UserStatus.APPROVED.value,
            is_active=True,
            failed_login_attempts=3
        )
        test_db.add(user)
        test_db.commit()

        # Successful login
        result = auth_service.authenticate_user(test_db, "resetuser", "TestPassword123!")

        test_db.refresh(user)
        assert result is not None
        assert user.failed_login_attempts == 0


class TestSessionSecretValidation:
    """Session secret configuration validation tests"""

    def test_session_secret_rejects_default_value(self):
        """Test that default SESSION_SECRET value raises error"""
        from pydantic import ValidationError

        with pytest.raises((ValueError, ValidationError)):
            from backend.config.settings import Settings
            # Create settings with default secret
            Settings(SESSION_SECRET="your-secret-key-change-in-production")

    def test_session_secret_accepts_valid_value(self):
        """Test that valid SESSION_SECRET is accepted"""
        from backend.config.settings import Settings

        # Should not raise
        settings = Settings(
            SESSION_SECRET="a1b2c3d4e5f6789012345678901234567890abcdef"
        )
        assert settings.SESSION_SECRET == "a1b2c3d4e5f6789012345678901234567890abcdef"


class TestInactiveUser:
    """Tests for inactive user handling"""

    def test_inactive_user_cannot_login(self, test_db):
        """Test that inactive user cannot authenticate"""
        from backend.services.auth_service import auth_service
        from backend.models.user import UserStatus

        user = User(
            username="inactiveuser",
            email="inactive@kca.kr",
            password_hash=auth_service.get_password_hash("TestPassword123!"),
            role="user",
            status=UserStatus.APPROVED.value,
            is_active=False  # Inactive
        )
        test_db.add(user)
        test_db.commit()

        with pytest.raises(AuthenticationError) as exc_info:
            auth_service.authenticate_user(
                test_db, "inactiveuser", "TestPassword123!"
            )

        assert exc_info.value.error_code == "INACTIVE"


class TestPasswordPolicy:
    """Password policy validation tests"""

    def test_empty_password_handling(self):
        """Test that empty password is handled safely"""
        auth_service = AuthService()

        # Empty password should still hash without error
        hashed = auth_service.get_password_hash("")
        assert hashed is not None

        # Verification should work correctly
        assert auth_service.verify_password("", hashed) is True
        assert auth_service.verify_password("notempty", hashed) is False

    def test_long_password_handling(self):
        """Test that long passwords are handled correctly"""
        auth_service = AuthService()
        long_password = "A" * 1000  # 1000 character password

        hashed = auth_service.get_password_hash(long_password)
        assert auth_service.verify_password(long_password, hashed) is True

    def test_special_characters_in_password(self):
        """Test passwords with special characters"""
        auth_service = AuthService()
        special_password = "Test!@#$%^&*()_+-=[]{}|;':\",./<>?"

        hashed = auth_service.get_password_hash(special_password)
        assert auth_service.verify_password(special_password, hashed) is True

    def test_unicode_password_handling(self):
        """Test passwords with unicode characters"""
        auth_service = AuthService()
        unicode_password = "Test123!"

        hashed = auth_service.get_password_hash(unicode_password)
        assert auth_service.verify_password(unicode_password, hashed) is True
