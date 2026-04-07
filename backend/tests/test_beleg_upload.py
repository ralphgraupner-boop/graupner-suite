"""
Test suite for Beleg-Upload (file attachments) feature for Buchungen.
Features tested:
- POST /api/buchhaltung/buchungen/{id}/belege - upload file attachment
- GET /api/buchhaltung/belege/{beleg_id}/download - download file
- DELETE /api/buchhaltung/buchungen/{id}/belege/{beleg_id} - delete beleg
- Upload rejection for disallowed extensions
- Multiple belege per buchung
- CSV export includes 'Belege' column with filenames
"""
import pytest
import requests
import os
import io
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Allowed extensions as per backend
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp", "pdf", "doc", "docx", "xls", "xlsx", "csv", "txt"}


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping tests")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token for JSON requests"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="module")
def auth_headers_multipart(auth_token):
    """Headers with auth token for multipart/form-data requests (no Content-Type)"""
    return {
        "Authorization": f"Bearer {auth_token}"
    }


@pytest.fixture(scope="module")
def test_buchung(auth_headers):
    """Create a test buchung for beleg tests"""
    response = requests.post(f"{BASE_URL}/api/buchhaltung/buchungen",
        headers=auth_headers,
        json={
            "typ": "ausgabe",
            "kategorie": "Material",
            "beschreibung": "TEST_Beleg_Upload_Buchung",
            "betrag_netto": 100,
            "mwst_satz": 19,
            "datum": datetime.now().strftime("%Y-%m-%d")
        }
    )
    assert response.status_code == 200, f"Failed to create test buchung: {response.text}"
    buchung = response.json()
    yield buchung
    # Cleanup
    requests.delete(f"{BASE_URL}/api/buchhaltung/buchungen/{buchung['id']}", headers=auth_headers)


class TestBelegUpload:
    """Test Beleg upload functionality"""
    
    def test_upload_pdf_beleg(self, auth_headers_multipart, test_buchung):
        """POST /api/buchhaltung/buchungen/{id}/belege uploads a PDF file"""
        buchung_id = test_buchung["id"]
        
        # Create a fake PDF file
        pdf_content = b"%PDF-1.4 fake pdf content for testing"
        files = {"file": ("test_rechnung.pdf", io.BytesIO(pdf_content), "application/pdf")}
        
        response = requests.post(
            f"{BASE_URL}/api/buchhaltung/buchungen/{buchung_id}/belege",
            headers=auth_headers_multipart,
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Response should contain beleg id"
        assert "storage_path" in data, "Response should contain storage_path"
        assert "original_filename" in data, "Response should contain original_filename"
        assert "content_type" in data, "Response should contain content_type"
        assert "size" in data, "Response should contain size"
        assert "created_at" in data, "Response should contain created_at"
        
        # Verify values
        assert data["original_filename"] == "test_rechnung.pdf"
        assert data["content_type"] == "application/pdf"
        assert data["size"] == len(pdf_content)
        
        print(f"✓ PDF beleg uploaded successfully: {data['original_filename']} (id: {data['id']})")
        
        # Store beleg_id for later tests
        self.__class__.beleg_id = data["id"]
        self.__class__.buchung_id = buchung_id
    
    def test_upload_image_beleg(self, auth_headers_multipart, test_buchung):
        """Upload an image file (JPG)"""
        buchung_id = test_buchung["id"]
        
        # Create a fake JPG file (minimal JPEG header)
        jpg_content = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00fake image'
        files = {"file": ("quittung.jpg", io.BytesIO(jpg_content), "image/jpeg")}
        
        response = requests.post(
            f"{BASE_URL}/api/buchhaltung/buchungen/{buchung_id}/belege",
            headers=auth_headers_multipart,
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["original_filename"] == "quittung.jpg"
        print(f"✓ JPG beleg uploaded successfully: {data['original_filename']}")
        
        self.__class__.image_beleg_id = data["id"]
    
    def test_upload_txt_beleg(self, auth_headers_multipart, test_buchung):
        """Upload a text file"""
        buchung_id = test_buchung["id"]
        
        txt_content = b"This is a test text file for beleg upload"
        files = {"file": ("notiz.txt", io.BytesIO(txt_content), "text/plain")}
        
        response = requests.post(
            f"{BASE_URL}/api/buchhaltung/buchungen/{buchung_id}/belege",
            headers=auth_headers_multipart,
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["original_filename"] == "notiz.txt"
        print(f"✓ TXT beleg uploaded successfully: {data['original_filename']}")
    
    def test_upload_excel_beleg(self, auth_headers_multipart, test_buchung):
        """Upload an Excel file"""
        buchung_id = test_buchung["id"]
        
        # Minimal xlsx-like content (just for testing extension)
        xlsx_content = b"PK\x03\x04fake xlsx content"
        files = {"file": ("tabelle.xlsx", io.BytesIO(xlsx_content), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        
        response = requests.post(
            f"{BASE_URL}/api/buchhaltung/buchungen/{buchung_id}/belege",
            headers=auth_headers_multipart,
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["original_filename"] == "tabelle.xlsx"
        print(f"✓ XLSX beleg uploaded successfully: {data['original_filename']}")


class TestBelegDownload:
    """Test Beleg download functionality"""
    
    def test_download_beleg(self, auth_headers_multipart, test_buchung):
        """GET /api/buchhaltung/belege/{beleg_id}/download returns the file"""
        buchung_id = test_buchung["id"]
        
        # First upload a beleg
        pdf_content = b"%PDF-1.4 test content for download"
        files = {"file": ("download_test.pdf", io.BytesIO(pdf_content), "application/pdf")}
        
        upload_response = requests.post(
            f"{BASE_URL}/api/buchhaltung/buchungen/{buchung_id}/belege",
            headers=auth_headers_multipart,
            files=files
        )
        assert upload_response.status_code == 200
        beleg_id = upload_response.json()["id"]
        
        # Now download it
        download_response = requests.get(
            f"{BASE_URL}/api/buchhaltung/belege/{beleg_id}/download",
            headers=auth_headers_multipart
        )
        
        assert download_response.status_code == 200, f"Expected 200, got {download_response.status_code}: {download_response.text}"
        
        # Verify content
        assert download_response.content == pdf_content, "Downloaded content should match uploaded content"
        
        # Verify headers
        content_type = download_response.headers.get("content-type", "")
        assert "pdf" in content_type.lower() or "octet-stream" in content_type.lower(), f"Content-Type should be PDF, got: {content_type}"
        
        content_disp = download_response.headers.get("content-disposition", "")
        assert "download_test.pdf" in content_disp, f"Content-Disposition should contain filename, got: {content_disp}"
        
        print(f"✓ Beleg downloaded successfully with correct content and headers")
    
    def test_download_nonexistent_beleg_returns_404(self, auth_headers_multipart):
        """Downloading non-existent beleg should return 404"""
        response = requests.get(
            f"{BASE_URL}/api/buchhaltung/belege/nonexistent-id-12345/download",
            headers=auth_headers_multipart
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent beleg returns 404")


class TestBelegDelete:
    """Test Beleg delete functionality"""
    
    def test_delete_beleg(self, auth_headers, auth_headers_multipart, test_buchung):
        """DELETE /api/buchhaltung/buchungen/{id}/belege/{beleg_id} removes the beleg"""
        buchung_id = test_buchung["id"]
        
        # First upload a beleg
        pdf_content = b"%PDF-1.4 test content for delete"
        files = {"file": ("delete_test.pdf", io.BytesIO(pdf_content), "application/pdf")}
        
        upload_response = requests.post(
            f"{BASE_URL}/api/buchhaltung/buchungen/{buchung_id}/belege",
            headers=auth_headers_multipart,
            files=files
        )
        assert upload_response.status_code == 200
        beleg_id = upload_response.json()["id"]
        
        # Delete the beleg
        delete_response = requests.delete(
            f"{BASE_URL}/api/buchhaltung/buchungen/{buchung_id}/belege/{beleg_id}",
            headers=auth_headers
        )
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        data = delete_response.json()
        assert "message" in data
        assert "gelöscht" in data["message"].lower() or "deleted" in data["message"].lower()
        
        # Verify beleg is gone - download should return 404
        download_response = requests.get(
            f"{BASE_URL}/api/buchhaltung/belege/{beleg_id}/download",
            headers=auth_headers_multipart
        )
        assert download_response.status_code == 404, "Deleted beleg should not be downloadable"
        
        print(f"✓ Beleg deleted successfully and no longer downloadable")
    
    def test_delete_nonexistent_beleg_returns_404(self, auth_headers, test_buchung):
        """Deleting non-existent beleg should return 404"""
        buchung_id = test_buchung["id"]
        response = requests.delete(
            f"{BASE_URL}/api/buchhaltung/buchungen/{buchung_id}/belege/nonexistent-id-12345",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent beleg delete returns 404")


class TestBelegValidation:
    """Test Beleg upload validation"""
    
    def test_reject_disallowed_extension_exe(self, auth_headers_multipart, test_buchung):
        """Upload should reject .exe files"""
        buchung_id = test_buchung["id"]
        
        exe_content = b"MZ fake exe content"
        files = {"file": ("malware.exe", io.BytesIO(exe_content), "application/octet-stream")}
        
        response = requests.post(
            f"{BASE_URL}/api/buchhaltung/buchungen/{buchung_id}/belege",
            headers=auth_headers_multipart,
            files=files
        )
        
        assert response.status_code == 400, f"Expected 400 for .exe, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        assert "nicht erlaubt" in data["detail"].lower() or "not allowed" in data["detail"].lower()
        print("✓ .exe files are rejected")
    
    def test_reject_disallowed_extension_js(self, auth_headers_multipart, test_buchung):
        """Upload should reject .js files"""
        buchung_id = test_buchung["id"]
        
        js_content = b"console.log('malicious');"
        files = {"file": ("script.js", io.BytesIO(js_content), "application/javascript")}
        
        response = requests.post(
            f"{BASE_URL}/api/buchhaltung/buchungen/{buchung_id}/belege",
            headers=auth_headers_multipart,
            files=files
        )
        
        assert response.status_code == 400, f"Expected 400 for .js, got {response.status_code}"
        print("✓ .js files are rejected")
    
    def test_reject_disallowed_extension_php(self, auth_headers_multipart, test_buchung):
        """Upload should reject .php files"""
        buchung_id = test_buchung["id"]
        
        php_content = b"<?php echo 'malicious'; ?>"
        files = {"file": ("backdoor.php", io.BytesIO(php_content), "application/x-php")}
        
        response = requests.post(
            f"{BASE_URL}/api/buchhaltung/buchungen/{buchung_id}/belege",
            headers=auth_headers_multipart,
            files=files
        )
        
        assert response.status_code == 400, f"Expected 400 for .php, got {response.status_code}"
        print("✓ .php files are rejected")
    
    def test_upload_to_nonexistent_buchung_returns_404(self, auth_headers_multipart):
        """Upload to non-existent buchung should return 404"""
        pdf_content = b"%PDF-1.4 test"
        files = {"file": ("test.pdf", io.BytesIO(pdf_content), "application/pdf")}
        
        response = requests.post(
            f"{BASE_URL}/api/buchhaltung/buchungen/nonexistent-buchung-id/belege",
            headers=auth_headers_multipart,
            files=files
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Upload to non-existent buchung returns 404")


class TestMultipleBelege:
    """Test multiple belege per buchung"""
    
    def test_multiple_belege_per_buchung(self, auth_headers, auth_headers_multipart):
        """Multiple belege can be attached to a single buchung"""
        # Create a fresh buchung
        create_response = requests.post(f"{BASE_URL}/api/buchhaltung/buchungen",
            headers=auth_headers,
            json={
                "typ": "ausgabe",
                "kategorie": "Material",
                "beschreibung": "TEST_Multiple_Belege",
                "betrag_netto": 200,
                "mwst_satz": 19,
                "datum": datetime.now().strftime("%Y-%m-%d")
            }
        )
        assert create_response.status_code == 200
        buchung_id = create_response.json()["id"]
        
        # Upload 3 different belege
        beleg_ids = []
        for i, (name, content) in enumerate([
            ("rechnung_1.pdf", b"%PDF-1.4 rechnung 1"),
            ("quittung.jpg", b'\xff\xd8\xff\xe0 fake jpg'),
            ("notizen.txt", b"Some notes about this expense")
        ]):
            files = {"file": (name, io.BytesIO(content), "application/octet-stream")}
            response = requests.post(
                f"{BASE_URL}/api/buchhaltung/buchungen/{buchung_id}/belege",
                headers=auth_headers_multipart,
                files=files
            )
            assert response.status_code == 200, f"Failed to upload beleg {i+1}: {response.text}"
            beleg_ids.append(response.json()["id"])
        
        # Verify buchung now has 3 belege
        get_response = requests.get(f"{BASE_URL}/api/buchhaltung/buchungen",
            headers=auth_headers,
            params={"zeitraum": "alle"}
        )
        assert get_response.status_code == 200
        
        buchungen = get_response.json()
        test_buchung = next((b for b in buchungen if b["id"] == buchung_id), None)
        assert test_buchung is not None, "Test buchung not found"
        
        belege = test_buchung.get("belege", [])
        assert len(belege) == 3, f"Expected 3 belege, got {len(belege)}"
        
        filenames = [b["original_filename"] for b in belege]
        assert "rechnung_1.pdf" in filenames
        assert "quittung.jpg" in filenames
        assert "notizen.txt" in filenames
        
        print(f"✓ Multiple belege ({len(belege)}) attached to single buchung: {filenames}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/buchhaltung/buchungen/{buchung_id}", headers=auth_headers)


class TestCSVExportWithBelege:
    """Test CSV export includes Belege column"""
    
    def test_csv_export_includes_belege_column(self, auth_headers, auth_headers_multipart):
        """CSV export should include 'Belege' column with filenames"""
        # Create a buchung with belege
        create_response = requests.post(f"{BASE_URL}/api/buchhaltung/buchungen",
            headers=auth_headers,
            json={
                "typ": "ausgabe",
                "kategorie": "Material",
                "beschreibung": "TEST_CSV_Belege_Export",
                "betrag_netto": 150,
                "mwst_satz": 19,
                "datum": datetime.now().strftime("%Y-%m-%d")
            }
        )
        assert create_response.status_code == 200
        buchung_id = create_response.json()["id"]
        
        # Upload 2 belege
        for name in ["csv_test_rechnung.pdf", "csv_test_quittung.jpg"]:
            files = {"file": (name, io.BytesIO(b"test content"), "application/octet-stream")}
            response = requests.post(
                f"{BASE_URL}/api/buchhaltung/buchungen/{buchung_id}/belege",
                headers=auth_headers_multipart,
                files=files
            )
            assert response.status_code == 200
        
        # Export CSV
        csv_response = requests.get(f"{BASE_URL}/api/buchhaltung/export-csv",
            headers=auth_headers,
            params={"zeitraum": "alle"}
        )
        assert csv_response.status_code == 200
        
        csv_content = csv_response.text
        lines = csv_content.split("\n")
        
        # Check header has Belege column
        header = lines[0]
        assert "Belege" in header, f"CSV header should contain 'Belege' column, got: {header}"
        
        # Find the test buchung row
        test_row = None
        for line in lines[1:]:
            if "TEST_CSV_Belege_Export" in line:
                test_row = line
                break
        
        assert test_row is not None, "Test buchung not found in CSV export"
        
        # Verify belege filenames are in the row
        assert "csv_test_rechnung.pdf" in test_row, f"CSV row should contain beleg filename, got: {test_row}"
        assert "csv_test_quittung.jpg" in test_row, f"CSV row should contain beleg filename, got: {test_row}"
        
        print(f"✓ CSV export includes Belege column with filenames")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/buchhaltung/buchungen/{buchung_id}", headers=auth_headers)


class TestBelegAuthRequired:
    """Test that beleg endpoints require authentication"""
    
    def test_upload_beleg_requires_auth(self):
        """POST /api/buchhaltung/buchungen/{id}/belege requires auth"""
        files = {"file": ("test.pdf", io.BytesIO(b"test"), "application/pdf")}
        response = requests.post(
            f"{BASE_URL}/api/buchhaltung/buchungen/some-id/belege",
            files=files
        )
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        print("✓ Upload beleg requires authentication")
    
    def test_download_beleg_requires_auth(self):
        """GET /api/buchhaltung/belege/{id}/download requires auth"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/belege/some-id/download")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        print("✓ Download beleg requires authentication")
    
    def test_delete_beleg_requires_auth(self):
        """DELETE /api/buchhaltung/buchungen/{id}/belege/{id} requires auth"""
        response = requests.delete(f"{BASE_URL}/api/buchhaltung/buchungen/some-id/belege/some-beleg-id")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        print("✓ Delete beleg requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
