"""
Pytest fixtures for backend tests
"""
import os
import sys
import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import Base
from backend.models.user import User


@pytest.fixture(scope="function")
def test_db():
    """Create a fresh in-memory SQLite database for each test"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def sample_user(test_db):
    """Create a sample user for testing"""
    from backend.services.auth_service import auth_service
    from backend.models.user import UserStatus

    user = User(
        username="testuser",
        email="test@kca.kr",
        password_hash=auth_service.get_password_hash("TestPassword123!"),
        role="user",
        status=UserStatus.APPROVED.value,
        is_active=True
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def locked_user(test_db):
    """Create a locked user for testing"""
    from backend.services.auth_service import auth_service
    from backend.models.user import UserStatus

    user = User(
        username="lockeduser",
        email="locked@kca.kr",
        password_hash=auth_service.get_password_hash("TestPassword123!"),
        role="user",
        status=UserStatus.APPROVED.value,
        is_active=True,
        failed_login_attempts=5,
        locked_until=datetime.now(timezone.utc) + timedelta(minutes=15)
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def admin_user(test_db):
    """Create an admin user for testing"""
    from backend.services.auth_service import auth_service
    from backend.models.user import UserStatus

    user = User(
        username="admin",
        email="admin@kca.kr",
        password_hash=auth_service.get_password_hash("AdminPassword123!"),
        role="admin",
        status=UserStatus.APPROVED.value,
        is_active=True
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user
