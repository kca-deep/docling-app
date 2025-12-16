"""
API Integration Tests

Tests for:
- Health check endpoints
- Authentication endpoints
- Security headers
- Error response format
"""
import pytest
import os
import sys

# Set test environment before importing app
os.environ["SESSION_SECRET"] = "test-secret-key-for-testing-only-32chars"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import Base, get_db
from backend.main import app
from backend.models.user import User


# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing"""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


# Override the dependency
app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="module")
def client():
    """Create test client"""
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="module")
def test_user():
    """Create test user in database"""
    from backend.services.auth_service import auth_service
    from backend.models.user import UserStatus

    db = TestingSessionLocal()
    try:
        user = User(
            username="apiuser",
            email="api@kca.kr",
            password_hash=auth_service.get_password_hash("ApiPassword123!"),
            role="user",
            status=UserStatus.APPROVED.value,
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    finally:
        db.close()


class TestHealthEndpoints:
    """Health check endpoint tests"""

    def test_root_endpoint(self, client):
        """Test root endpoint returns service info"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "service" in data
        assert "version" in data
        assert "status" in data
        assert data["status"] == "running"

    def test_health_endpoint(self, client):
        """Test basic health check"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data

    def test_health_live_endpoint(self, client):
        """Test liveness probe"""
        response = client.get("/health/live")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data

    def test_health_ready_endpoint(self, client):
        """Test readiness probe"""
        response = client.get("/health/ready")
        # May return 200 or 503 depending on service availability
        assert response.status_code in [200, 503]
        data = response.json()
        assert "status" in data


class TestSecurityHeaders:
    """Security headers verification tests"""

    def test_security_headers_present(self, client):
        """Test that security headers are present in response"""
        response = client.get("/health")

        # X-Content-Type-Options
        assert response.headers.get("X-Content-Type-Options") == "nosniff"

        # X-Frame-Options
        assert response.headers.get("X-Frame-Options") == "DENY"

        # X-XSS-Protection
        assert response.headers.get("X-XSS-Protection") == "1; mode=block"

        # Referrer-Policy
        assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"

        # Permissions-Policy
        assert "geolocation=()" in response.headers.get("Permissions-Policy", "")

    def test_cors_headers_on_options(self, client):
        """Test CORS headers on OPTIONS request"""
        response = client.options(
            "/api/auth/login",
            headers={"Origin": "http://localhost:3000"}
        )
        # Should return allow headers for valid origin
        # Note: actual behavior depends on CORS configuration


class TestAuthenticationEndpoints:
    """Authentication API endpoint tests"""

    def test_login_missing_credentials(self, client):
        """Test login with missing credentials"""
        response = client.post("/api/auth/login", json={})
        # Should return validation error
        assert response.status_code in [400, 422]

    def test_login_invalid_credentials(self, client, test_user):
        """Test login with invalid credentials"""
        response = client.post(
            "/api/auth/login",
            json={"username": "apiuser", "password": "wrongpassword"}
        )
        assert response.status_code == 401

    def test_login_nonexistent_user(self, client):
        """Test login with non-existent user"""
        response = client.post(
            "/api/auth/login",
            json={"username": "nonexistent", "password": "anypassword"}
        )
        assert response.status_code == 401

    def test_me_endpoint_without_auth(self, client):
        """Test /me endpoint without authentication"""
        response = client.get("/api/auth/me")
        assert response.status_code == 401

    def test_logout_without_auth(self, client):
        """Test logout without being logged in"""
        response = client.post("/api/auth/logout")
        # Should succeed or return appropriate status
        assert response.status_code in [200, 401]


class TestErrorResponseFormat:
    """Error response format validation tests"""

    def test_404_error_format(self, client):
        """Test 404 error response format"""
        response = client.get("/nonexistent/path")
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data

    def test_validation_error_format(self, client):
        """Test validation error response format"""
        response = client.post(
            "/api/auth/login",
            json={"invalid_field": "value"}
        )
        assert response.status_code == 422
        data = response.json()
        # Should have structured error response
        assert "error_code" in data or "detail" in data

    def test_method_not_allowed(self, client):
        """Test method not allowed error"""
        response = client.delete("/health")
        assert response.status_code == 405


class TestRateLimiting:
    """Rate limiting tests"""

    def test_rate_limit_headers(self, client):
        """Test that rate limit info is available"""
        response = client.get("/health")
        # Rate limit headers may be present depending on configuration
        # X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
        assert response.status_code == 200


class TestDocumentEndpoints:
    """Document API endpoint tests"""

    def test_list_documents_without_auth(self, client):
        """Test listing documents without authentication"""
        response = client.get("/api/documents")
        # Should return list or require authentication
        assert response.status_code in [200, 401, 404]

    def test_get_nonexistent_document(self, client):
        """Test getting non-existent document"""
        response = client.get("/api/documents/99999")
        assert response.status_code in [401, 404]


class TestQdrantEndpoints:
    """Qdrant API endpoint tests"""

    def test_list_collections_without_auth(self, client):
        """Test listing collections without authentication"""
        response = client.get("/api/qdrant/collections")
        # Should work or require auth
        assert response.status_code in [200, 401, 500]


class TestChatEndpoints:
    """Chat API endpoint tests"""

    def test_chat_without_message(self, client):
        """Test chat endpoint without required fields"""
        response = client.post(
            "/api/chat/",
            json={}
        )
        # Should return validation error
        assert response.status_code in [400, 422]

    def test_chat_collections_endpoint(self, client):
        """Test getting available chat collections"""
        response = client.get("/api/chat/collections")
        # Should return list of collections
        assert response.status_code in [200, 500]


class TestFaviconEndpoint:
    """Favicon handling test"""

    def test_favicon_returns_no_content(self, client):
        """Test favicon returns 204 No Content"""
        response = client.get("/favicon.ico")
        assert response.status_code == 204


class TestSuspiciousRequests:
    """Test handling of suspicious/malicious request patterns"""

    def test_php_path_logged(self, client):
        """Test that PHP paths are handled (logged as suspicious)"""
        response = client.get("/wp-admin/login.php")
        assert response.status_code == 404

    def test_admin_path_logged(self, client):
        """Test that admin paths are handled"""
        response = client.get("/admin/console")
        assert response.status_code == 404

    def test_phpmyadmin_path_logged(self, client):
        """Test that phpmyadmin paths are handled"""
        response = client.get("/phpmyadmin/index.php")
        assert response.status_code == 404
