"""
Portal API Tests v40 - Kundenportal Module Testing
Tests for the newly installed Kundenportal module:
- Admin: Portal CRUD operations
- Admin: File upload/list/delete
- Admin: Portal from customer (module_kunden)
- Public: Portal verification with password
- Public: File upload/list/download
- Customer notes and admin notes
"""
import pytest
import requests
import os
import io
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "Graupner!Suite2026"
TEST_PORTAL_PASSWORD = "kunde2024"


class TestPortalAuth:
    """Test admin authentication for portal endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_login_success(self):
        """Test admin login returns token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "username" in data
        assert data["username"] == ADMIN_USERNAME


class TestPortalAdminCRUD:
    """Test admin portal CRUD operations"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get admin auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    @pytest.fixture(scope="class")
    def created_portal(self, auth_headers):
        """Create a test portal and return it"""
        response = requests.post(f"{BASE_URL}/api/portals", 
            json={
                "customer_name": f"TEST_Kunde_{uuid.uuid4().hex[:6]}",
                "customer_email": f"test_{uuid.uuid4().hex[:6]}@example.com",
                "description": "Test Portal für Dachsanierung",
                "password": TEST_PORTAL_PASSWORD,
                "weeks": 8
            },
            headers=auth_headers
        )
        assert response.status_code == 200, f"Create portal failed: {response.text}"
        portal = response.json()
        yield portal
        # Cleanup: delete portal after tests
        requests.delete(f"{BASE_URL}/api/portals/{portal['id']}", headers=auth_headers)
    
    def test_create_portal(self, auth_headers):
        """POST /api/portals - Create new portal"""
        response = requests.post(f"{BASE_URL}/api/portals", 
            json={
                "customer_name": f"TEST_CreatePortal_{uuid.uuid4().hex[:6]}",
                "customer_email": f"create_{uuid.uuid4().hex[:6]}@example.com",
                "description": "Test Description",
                "password": "testpass123",
                "weeks": 4
            },
            headers=auth_headers
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert "token" in data
        assert "customer_name" in data
        assert "password_plain" in data
        assert "active" in data
        assert "expires_at" in data
        assert "created_at" in data
        
        # Verify values
        assert data["active"] == True
        assert data["password_plain"] == "testpass123"
        assert len(data["token"]) > 20  # Token should be long
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/portals/{data['id']}", headers=auth_headers)
    
    def test_list_portals(self, auth_headers, created_portal):
        """GET /api/portals - List all portals"""
        response = requests.get(f"{BASE_URL}/api/portals", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        # Find our created portal
        portal_ids = [p["id"] for p in data]
        assert created_portal["id"] in portal_ids
    
    def test_deactivate_portal(self, auth_headers, created_portal):
        """PUT /api/portals/{id} - Deactivate portal"""
        response = requests.put(
            f"{BASE_URL}/api/portals/{created_portal['id']}", 
            json={"active": False},
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # Verify deactivation
        list_response = requests.get(f"{BASE_URL}/api/portals", headers=auth_headers)
        portals = list_response.json()
        portal = next((p for p in portals if p["id"] == created_portal["id"]), None)
        assert portal is not None
        assert portal["active"] == False
        
        # Re-activate for other tests
        requests.put(
            f"{BASE_URL}/api/portals/{created_portal['id']}", 
            json={"active": True},
            headers=auth_headers
        )
    
    def test_update_portal_description(self, auth_headers, created_portal):
        """PUT /api/portals/{id} - Update description"""
        new_description = "Updated Test Description"
        response = requests.put(
            f"{BASE_URL}/api/portals/{created_portal['id']}", 
            json={"description": new_description},
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # Verify update
        list_response = requests.get(f"{BASE_URL}/api/portals", headers=auth_headers)
        portals = list_response.json()
        portal = next((p for p in portals if p["id"] == created_portal["id"]), None)
        assert portal["description"] == new_description
    
    def test_delete_portal(self, auth_headers):
        """DELETE /api/portals/{id} - Delete portal"""
        # Create a portal to delete
        create_response = requests.post(f"{BASE_URL}/api/portals", 
            json={
                "customer_name": f"TEST_DeletePortal_{uuid.uuid4().hex[:6]}",
                "password": "deletetest",
                "weeks": 1
            },
            headers=auth_headers
        )
        portal_id = create_response.json()["id"]
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/portals/{portal_id}", headers=auth_headers)
        assert response.status_code == 200
        
        # Verify deletion
        list_response = requests.get(f"{BASE_URL}/api/portals", headers=auth_headers)
        portal_ids = [p["id"] for p in list_response.json()]
        assert portal_id not in portal_ids


class TestPortalFromCustomer:
    """Test creating portal from Kunden-Modul customer"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get admin auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    def test_get_customers_from_kunden_modul(self, auth_headers):
        """GET /api/modules/kunden/data - Get customers for portal dropdown"""
        response = requests.get(f"{BASE_URL}/api/modules/kunden/data", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} customers in Kunden-Modul")
    
    def test_create_portal_from_customer(self, auth_headers):
        """POST /api/portals/from-customer/{id} - Create portal from Kunden-Modul"""
        # First get a customer
        customers_response = requests.get(f"{BASE_URL}/api/modules/kunden/data", headers=auth_headers)
        customers = customers_response.json()
        
        if len(customers) == 0:
            # Create a test customer first
            create_customer = requests.post(f"{BASE_URL}/api/modules/kunden/data", 
                json={
                    "vorname": "Test",
                    "nachname": f"PortalKunde_{uuid.uuid4().hex[:6]}",
                    "email": f"portal_test_{uuid.uuid4().hex[:6]}@example.com"
                },
                headers=auth_headers
            )
            assert create_customer.status_code == 200
            customer = create_customer.json()
        else:
            # Find a customer with email
            customer = next((c for c in customers if c.get("email")), None)
            if not customer:
                # Create one with email
                create_customer = requests.post(f"{BASE_URL}/api/modules/kunden/data", 
                    json={
                        "vorname": "Test",
                        "nachname": f"PortalKunde_{uuid.uuid4().hex[:6]}",
                        "email": f"portal_test_{uuid.uuid4().hex[:6]}@example.com"
                    },
                    headers=auth_headers
                )
                customer = create_customer.json()
        
        # Create portal from customer
        response = requests.post(
            f"{BASE_URL}/api/portals/from-customer/{customer['id']}",
            json={"portal_base_url": "https://handwerk-deploy.preview.emergentagent.com"},
            headers=auth_headers
        )
        
        # May fail if portal already exists for this customer
        if response.status_code == 400 and "existiert bereits" in response.text:
            print("Portal already exists for this customer - expected behavior")
            return
        
        assert response.status_code == 200, f"Create from customer failed: {response.text}"
        portal = response.json()
        
        assert "id" in portal
        assert "token" in portal
        assert "customer_id" in portal
        assert portal["customer_id"] == customer["id"]
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/portals/{portal['id']}", headers=auth_headers)


class TestPortalAdminFiles:
    """Test admin file operations on portals"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get admin auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    @pytest.fixture(scope="class")
    def test_portal(self, auth_headers):
        """Create a test portal for file operations"""
        response = requests.post(f"{BASE_URL}/api/portals", 
            json={
                "customer_name": f"TEST_FilePortal_{uuid.uuid4().hex[:6]}",
                "password": TEST_PORTAL_PASSWORD,
                "weeks": 8
            },
            headers=auth_headers
        )
        portal = response.json()
        yield portal
        requests.delete(f"{BASE_URL}/api/portals/{portal['id']}", headers=auth_headers)
    
    def test_upload_file_to_portal(self, auth_headers, test_portal):
        """POST /api/portals/{id}/upload - Upload file as admin"""
        # Create a simple test image (1x1 red PNG)
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,  # IDAT chunk
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
            0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x18, 0xDD,
            0x8D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,  # IEND chunk
            0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {"file": ("test_image.png", io.BytesIO(png_data), "image/png")}
        data = {"description": "Test business document"}
        
        response = requests.post(
            f"{BASE_URL}/api/portals/{test_portal['id']}/upload",
            files=files,
            data=data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Upload failed: {response.text}"
        file_data = response.json()
        
        # Verify response
        assert "id" in file_data
        assert "storage_path" in file_data
        assert file_data["uploaded_by"] == "business"
        assert file_data["original_filename"] == "test_image.png"
        
        return file_data
    
    def test_list_portal_files(self, auth_headers, test_portal):
        """GET /api/portals/{id}/files - List files in portal"""
        # First upload a file
        png_data = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] + [0] * 50)
        files = {"file": ("list_test.png", io.BytesIO(png_data), "image/png")}
        requests.post(
            f"{BASE_URL}/api/portals/{test_portal['id']}/upload",
            files=files,
            data={"description": "List test file"},
            headers=auth_headers
        )
        
        # List files
        response = requests.get(
            f"{BASE_URL}/api/portals/{test_portal['id']}/files",
            headers=auth_headers
        )
        assert response.status_code == 200
        files_list = response.json()
        
        assert isinstance(files_list, list)
        assert len(files_list) >= 1
        
        # Verify file structure
        file = files_list[0]
        assert "id" in file
        assert "original_filename" in file
        assert "uploaded_by" in file
    
    def test_delete_file(self, auth_headers, test_portal):
        """DELETE /api/portals/files/{file_id} - Delete file"""
        # Upload a file to delete
        png_data = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] + [0] * 50)
        files = {"file": ("delete_test.png", io.BytesIO(png_data), "image/png")}
        upload_response = requests.post(
            f"{BASE_URL}/api/portals/{test_portal['id']}/upload",
            files=files,
            data={"description": "Delete test file"},
            headers=auth_headers
        )
        file_id = upload_response.json()["id"]
        
        # Delete the file
        response = requests.delete(
            f"{BASE_URL}/api/portals/files/{file_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # Verify deletion (file should not appear in list)
        list_response = requests.get(
            f"{BASE_URL}/api/portals/{test_portal['id']}/files",
            headers=auth_headers
        )
        file_ids = [f["id"] for f in list_response.json()]
        assert file_id not in file_ids


class TestPortalPublicAccess:
    """Test public portal access (no auth required)"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get admin auth headers for setup"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    @pytest.fixture(scope="class")
    def public_portal(self, auth_headers):
        """Create a portal for public access tests"""
        response = requests.post(f"{BASE_URL}/api/portals", 
            json={
                "customer_name": f"TEST_PublicPortal_{uuid.uuid4().hex[:6]}",
                "description": "Public access test portal",
                "password": TEST_PORTAL_PASSWORD,
                "weeks": 8
            },
            headers=auth_headers
        )
        portal = response.json()
        yield portal
        requests.delete(f"{BASE_URL}/api/portals/{portal['id']}", headers=auth_headers)
    
    def test_verify_portal_correct_password(self, public_portal):
        """POST /api/portal/verify/{token} - Verify with correct password"""
        response = requests.post(
            f"{BASE_URL}/api/portal/verify/{public_portal['token']}",
            json={"password": TEST_PORTAL_PASSWORD}
        )
        assert response.status_code == 200, f"Verify failed: {response.text}"
        data = response.json()
        
        assert data["valid"] == True
        assert "customer_name" in data
        assert "description" in data
        assert "expires_at" in data
    
    def test_verify_portal_wrong_password(self, public_portal):
        """POST /api/portal/verify/{token} - Reject wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/portal/verify/{public_portal['token']}",
            json={"password": "wrongpassword123"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
    
    def test_verify_portal_invalid_token(self):
        """POST /api/portal/verify/{token} - Reject invalid token"""
        response = requests.post(
            f"{BASE_URL}/api/portal/verify/invalid_token_12345",
            json={"password": TEST_PORTAL_PASSWORD}
        )
        assert response.status_code == 404
    
    def test_public_list_files(self, public_portal, auth_headers):
        """POST /api/portal/{token}/files - List files with password"""
        # First upload a file as admin
        png_data = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] + [0] * 50)
        files = {"file": ("public_list_test.png", io.BytesIO(png_data), "image/png")}
        requests.post(
            f"{BASE_URL}/api/portals/{public_portal['id']}/upload",
            files=files,
            data={"description": "Public list test"},
            headers=auth_headers
        )
        
        # List files as public user
        response = requests.post(
            f"{BASE_URL}/api/portal/{public_portal['token']}/files",
            json={"password": TEST_PORTAL_PASSWORD}
        )
        assert response.status_code == 200
        files_list = response.json()
        
        assert isinstance(files_list, list)
        assert len(files_list) >= 1
    
    def test_public_upload_image(self, public_portal):
        """POST /api/portal/{token}/upload - Customer uploads image"""
        # Create a valid JPEG header
        jpeg_data = bytes([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
            0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
            0x00, 0x01, 0x00, 0x00
        ] + [0] * 100 + [0xFF, 0xD9])
        
        files = {"file": ("customer_photo.jpg", io.BytesIO(jpeg_data), "image/jpeg")}
        data = {
            "password": TEST_PORTAL_PASSWORD,
            "description": "Foto vom Dach"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/portal/{public_portal['token']}/upload",
            files=files,
            data=data
        )
        assert response.status_code == 200, f"Upload failed: {response.text}"
        file_data = response.json()
        
        assert file_data["uploaded_by"] == "customer"
        assert "id" in file_data
    
    def test_public_upload_wrong_password(self, public_portal):
        """POST /api/portal/{token}/upload - Reject upload with wrong password"""
        jpeg_data = bytes([0xFF, 0xD8, 0xFF, 0xE0] + [0] * 50 + [0xFF, 0xD9])
        files = {"file": ("test.jpg", io.BytesIO(jpeg_data), "image/jpeg")}
        data = {"password": "wrongpassword"}
        
        response = requests.post(
            f"{BASE_URL}/api/portal/{public_portal['token']}/upload",
            files=files,
            data=data
        )
        assert response.status_code == 401


class TestPortalNotes:
    """Test customer notes and admin notes functionality"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get admin auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    @pytest.fixture(scope="class")
    def notes_portal(self, auth_headers):
        """Create a portal for notes tests"""
        response = requests.post(f"{BASE_URL}/api/portals", 
            json={
                "customer_name": f"TEST_NotesPortal_{uuid.uuid4().hex[:6]}",
                "password": TEST_PORTAL_PASSWORD,
                "weeks": 8
            },
            headers=auth_headers
        )
        portal = response.json()
        yield portal
        requests.delete(f"{BASE_URL}/api/portals/{portal['id']}", headers=auth_headers)
    
    def test_customer_add_note(self, notes_portal):
        """POST /api/portal/{token}/notes - Customer adds note"""
        response = requests.post(
            f"{BASE_URL}/api/portal/{notes_portal['token']}/notes",
            json={
                "password": TEST_PORTAL_PASSWORD,
                "type": "hinweis",
                "text": "Test Hinweis vom Kunden"
            }
        )
        assert response.status_code == 200, f"Add note failed: {response.text}"
        note = response.json()
        
        assert "id" in note
        assert note["type"] == "hinweis"
        assert note["text"] == "Test Hinweis vom Kunden"
        assert "created_at" in note
    
    def test_admin_add_note(self, auth_headers, notes_portal):
        """POST /api/portals/{id}/admin-notes - Admin adds note"""
        response = requests.post(
            f"{BASE_URL}/api/portals/{notes_portal['id']}/admin-notes",
            json={"text": "Test Nachricht vom Admin"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Add admin note failed: {response.text}"
        note = response.json()
        
        assert "id" in note
        assert note["type"] == "admin"
        assert note["text"] == "Test Nachricht vom Admin"
    
    def test_get_admin_notes(self, auth_headers, notes_portal):
        """GET /api/portals/{id}/admin-notes - Get admin notes"""
        response = requests.get(
            f"{BASE_URL}/api/portals/{notes_portal['id']}/admin-notes",
            headers=auth_headers
        )
        assert response.status_code == 200
        notes = response.json()
        assert isinstance(notes, list)


class TestPortalDeactivated:
    """Test that deactivated portals reject access"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get admin auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    @pytest.fixture(scope="class")
    def deactivated_portal(self, auth_headers):
        """Create and deactivate a portal"""
        # Create portal
        response = requests.post(f"{BASE_URL}/api/portals", 
            json={
                "customer_name": f"TEST_DeactivatedPortal_{uuid.uuid4().hex[:6]}",
                "password": TEST_PORTAL_PASSWORD,
                "weeks": 8
            },
            headers=auth_headers
        )
        portal = response.json()
        
        # Deactivate it
        requests.put(
            f"{BASE_URL}/api/portals/{portal['id']}", 
            json={"active": False},
            headers=auth_headers
        )
        
        yield portal
        requests.delete(f"{BASE_URL}/api/portals/{portal['id']}", headers=auth_headers)
    
    def test_deactivated_portal_verify_rejected(self, deactivated_portal):
        """Deactivated portal should reject verification"""
        response = requests.post(
            f"{BASE_URL}/api/portal/verify/{deactivated_portal['token']}",
            json={"password": TEST_PORTAL_PASSWORD}
        )
        assert response.status_code == 403
        assert "deaktiviert" in response.json().get("detail", "").lower()
    
    def test_deactivated_portal_upload_rejected(self, deactivated_portal):
        """Deactivated portal should reject uploads"""
        jpeg_data = bytes([0xFF, 0xD8, 0xFF, 0xE0] + [0] * 50 + [0xFF, 0xD9])
        files = {"file": ("test.jpg", io.BytesIO(jpeg_data), "image/jpeg")}
        data = {"password": TEST_PORTAL_PASSWORD}
        
        response = requests.post(
            f"{BASE_URL}/api/portal/{deactivated_portal['token']}/upload",
            files=files,
            data=data
        )
        assert response.status_code == 403


class TestPortalUnauthorized:
    """Test that admin endpoints require authentication"""
    
    def test_list_portals_unauthorized(self):
        """GET /api/portals without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/portals")
        assert response.status_code == 401
    
    def test_create_portal_unauthorized(self):
        """POST /api/portals without auth should fail"""
        response = requests.post(f"{BASE_URL}/api/portals", json={
            "customer_name": "Test",
            "password": "test123"
        })
        assert response.status_code == 401
    
    def test_upload_file_unauthorized(self):
        """POST /api/portals/{id}/upload without auth should fail"""
        response = requests.post(
            f"{BASE_URL}/api/portals/some-id/upload",
            files={"file": ("test.txt", b"test", "text/plain")}
        )
        assert response.status_code == 401


class TestPortalLookup:
    """Test portal lookup functionality"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get admin auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    def test_lookup_portal_by_email(self, auth_headers):
        """GET /api/portals/lookup - Lookup by email"""
        # Create a portal with email
        email = f"lookup_test_{uuid.uuid4().hex[:6]}@example.com"
        create_response = requests.post(f"{BASE_URL}/api/portals", 
            json={
                "customer_name": f"TEST_LookupPortal_{uuid.uuid4().hex[:6]}",
                "customer_email": email,
                "password": TEST_PORTAL_PASSWORD,
                "weeks": 8
            },
            headers=auth_headers
        )
        portal = create_response.json()
        
        # Lookup by email
        response = requests.get(
            f"{BASE_URL}/api/portals/lookup?email={email}",
            headers=auth_headers
        )
        assert response.status_code == 200
        found = response.json()
        
        if found:
            assert found["customer_email"] == email
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/portals/{portal['id']}", headers=auth_headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
