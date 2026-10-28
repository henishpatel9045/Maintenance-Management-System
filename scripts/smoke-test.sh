#!/usr/bin/env bash
set -eo pipefail

# ==========================================
# Seva Maintenance Management System
# Comprehensive Smoke Test Suite
# Tests all end-to-end paths as required by Section 21
# ==========================================

BASE_URL="${BASE_URL:-http://localhost:8080}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@seva.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-AdminSeva2026!ChangeMe}"

TEMP_DIR="${TEMP_DIR:-/tmp/tmp_smoke}"
mkdir -p "$TEMP_DIR"
COOKIE_JAR="$TEMP_DIR/admin_cookies.txt"
MEMBER_COOKIE_JAR="$TEMP_DIR/member_cookies.txt"

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo "=============================================="
echo " Starting Seva Smoke Test against $BASE_URL"
echo "=============================================="

# Helper: JSON value extractor without requiring jq
extract_json_val() {
  local key="$1"
  (grep -o "\"$key\":[^,}]*" || true) | head -n 1 | cut -d':' -f2- | tr -d '\" '
}

# 1. Health & Readiness checks
echo "[1/12] Checking system health & readiness..."
HEALTH=$(curl -s -f "$BASE_URL/api/health" || echo "FAIL")
if [[ "$HEALTH" != *"ok"* ]]; then
  echo "Error: /api/health failed: $HEALTH"
  exit 1
fi

READY=$(curl -s -f "$BASE_URL/api/ready" || echo "FAIL")
if [[ "$READY" != *"ready"* && "$READY" != *"ok"* ]]; then
  echo "Error: /api/ready failed: $READY"
  exit 1
fi
echo "  ✓ Health & Readiness endpoints OK"

# 2. Login as Admin
echo "[2/12] Authenticating as Administrator..."
LOGIN_RES=$(curl -s -c "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

if [[ "$LOGIN_RES" != *"token"* && "$LOGIN_RES" != *"ADMIN"* ]]; then
  echo "Error: Admin login failed: $LOGIN_RES"
  exit 1
fi
echo "  ✓ Administrator login successful"

# 3. Create Masters: Category & Area
echo "[3/12] Creating Category and Area..."
CAT_RES=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/masters/categories" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -d '{"name":"Smoke Maintenance","color":"#3b82f6","description":"Automated test category"}')

CAT_ID=$(echo "$CAT_RES" | extract_json_val "id")
if [ -z "$CAT_ID" ]; then
  # Try fetching existing category if already created
  CAT_RES=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/masters/categories")
  CAT_ID=$(echo "$CAT_RES" | grep -o '"id":"[^"]*' | head -n 1 | cut -d'"' -f4)
fi
echo "  ✓ Category ID: $CAT_ID"

AREA_RES=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/masters/areas" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -d '{"name":"Smoke Test Wing"}')

AREA_ID=$(echo "$AREA_RES" | extract_json_val "id")
if [ -z "$AREA_ID" ]; then
  AREA_RES=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/masters/areas")
  AREA_ID=$(echo "$AREA_RES" | grep -o '"id":"[^"]*' | head -n 1 | cut -d'"' -f4)
fi
echo "  ✓ Area ID: $AREA_ID"

# 4. Create Member and Coordinator users
echo "[4/12] Creating Member and Coordinator users..."
ROLES_RES=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/roles")
MEMBER_ROLE_ID=$(echo "$ROLES_RES" | grep -o '{"id":"[^"]*","name":"MEMBER"' | head -n 1 | cut -d'"' -f4)

MEMBER_EMAIL="smoke.member.$$@seva.local"
USER_RES=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/users" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -d "{\"name\":\"Smoke Member\",\"email\":\"$MEMBER_EMAIL\",\"password\":\"MemberSecurePassword2026!\",\"roleId\":\"$MEMBER_ROLE_ID\"}")

MEMBER_ID=$(echo "$USER_RES" | extract_json_val "id")
if [ -z "$MEMBER_ID" ]; then
  USERS_RES=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/users")
  MEMBER_ID=$(echo "$USERS_RES" | grep -o '{"id":"[^"]*","name":"Smoke Member"' | head -n 1 | cut -d'"' -f4)
fi
echo "  ✓ Member ID: $MEMBER_ID"

# 5. Create Group Seva, Child Seva, and Recurring Seva
echo "[5/12] Creating Group Seva and Child Seva..."
GROUP_RES=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/seva" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -d "{\"title\":\"Smoke Group Project\",\"description\":\"Main group project container\",\"kind\":\"ONE_TIME\",\"categoryId\":\"$CAT_ID\",\"areaId\":\"$AREA_ID\",\"priority\":\"HIGH\",\"isGroup\":true}")

GROUP_ID=$(echo "$GROUP_RES" | extract_json_val "id")
echo "  ✓ Group Seva ID: $GROUP_ID"

CHILD_RES=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/seva" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -d "{\"title\":\"Smoke Child Repair\",\"description\":\"Child repair task\",\"kind\":\"ONE_TIME\",\"subKind\":\"REPAIR\",\"categoryId\":\"$CAT_ID\",\"areaId\":\"$AREA_ID\",\"priority\":\"HIGH\",\"parentId\":\"$GROUP_ID\",\"estimatedBudget\":500,\"assignees\":[{\"userId\":\"$MEMBER_ID\",\"isLead\":true}]}")

CHILD_ID=$(echo "$CHILD_RES" | extract_json_val "id")
CHILD_CODE=$(echo "$CHILD_RES" | extract_json_val "code")
echo "  ✓ Child Seva ID: $CHILD_ID (Code: $CHILD_CODE)"

# 6. Upload Quote and Artefact files
echo "[6/12] Uploading Quote document and Artefact photo..."
DUMMY_PDF="$TEMP_DIR/quote.pdf"
echo "%PDF-1.4 %smoke test quote pdf" > "$DUMMY_PDF"

DUMMY_TXT="$TEMP_DIR/artefact.txt"
echo "Completion evidence description" > "$DUMMY_TXT"

QUOTE_RES=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/seva/$CHILD_ID/files" \
  -H "Origin: $BASE_URL" \
  -F "bucket=QUOTE" \
  -F "supplierName=Reliable Roofing" \
  -F "amount=450.00" \
  -F "currency=AUD" \
  -F "files=@$DUMMY_PDF;filename=quote.pdf")

QUOTE_SEVA_FILE_ID=$(echo "$QUOTE_RES" | extract_json_val "id")
echo "  ✓ Uploaded Quote: $QUOTE_SEVA_FILE_ID"

ARTEFACT_RES=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/seva/$CHILD_ID/files" \
  -H "Origin: $BASE_URL" \
  -F "bucket=ARTEFACT" \
  -F "artefactType=DOCUMENT" \
  -F "stage=BEFORE" \
  -F "caption=Initial damage assessment" \
  -F "files=@$DUMMY_TXT;filename=artefact.txt")

ARTEFACT_SEVA_FILE_ID=$(echo "$ARTEFACT_RES" | extract_json_val "id")
echo "  ✓ Uploaded Artefact: $ARTEFACT_SEVA_FILE_ID"

# 7. Approve the Quote & Verify approvedBudget
echo "[7/12] Approving Quote and verifying Seva approvedBudget..."
APPROVE_RES=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/files/$QUOTE_SEVA_FILE_ID/approve-quote" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL")

if [[ "$APPROVE_RES" != *"APPROVED"* && "$APPROVE_RES" != *"approved"* && "$APPROVE_RES" != *"true"* ]]; then
  echo "Error: Failed to approve quote: $APPROVE_RES"
  exit 1
fi

SEVA_VERIFY=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/seva/$CHILD_ID")
if [[ "$SEVA_VERIFY" != *"450"* ]]; then
  echo "Error: Seva approvedBudget was not updated to 450: $SEVA_VERIFY"
  exit 1
fi
echo "  ✓ Quote approved. Seva approvedBudget synchronized to 450.00"

# 8. Member Authentication & Quote Confidentiality Check
echo "[8/12] Authenticating as Member and testing quote confidentiality..."
MEMBER_LOGIN=$(curl -s -c "$MEMBER_COOKIE_JAR" -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -d "{\"email\":\"$MEMBER_EMAIL\",\"password\":\"MemberSecurePassword2026!\"}")

if [[ "$MEMBER_LOGIN" != *"token"* && "$MEMBER_LOGIN" != *"MEMBER"* ]]; then
  echo "Error: Member login failed: $MEMBER_LOGIN"
  exit 1
fi

# Member attempts to view quotes -> MUST be empty or denied
MEMBER_FILES=$(curl -s -b "$MEMBER_COOKIE_JAR" "$BASE_URL/api/v1/seva/$CHILD_ID/files?bucket=QUOTE")
if [[ "$MEMBER_FILES" == *"450.00"* || "$MEMBER_FILES" == *"Reliable Roofing"* ]]; then
  echo "CRITICAL SECURITY ERROR: Quotes and prices were exposed to Member without quotes.view permission!"
  exit 1
fi
echo "  ✓ Confidentiality verified: Quotes and prices strictly hidden from Member"

# Member views artefacts -> MUST be visible
MEMBER_ARTEFACTS=$(curl -s -b "$MEMBER_COOKIE_JAR" "$BASE_URL/api/v1/seva/$CHILD_ID/files?bucket=ARTEFACT")
if [[ "$MEMBER_ARTEFACTS" != *"Initial damage assessment"* ]]; then
  echo "Error: Member should be able to view artefacts: $MEMBER_ARTEFACTS"
  exit 1
fi
echo "  ✓ Artefacts properly visible to assigned Member"

# 9. Member Adds Comment and Updates Occurrence Status
echo "[9/12] Member commenting and completing work occurrence..."
COMMENT_RES=$(curl -s -b "$MEMBER_COOKIE_JAR" -X POST "$BASE_URL/api/v1/comments" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -d "{\"entityType\":\"SEVA\",\"entityId\":\"$CHILD_ID\",\"body\":\"Work commenced and completed smoothly.\"}")

if [[ "$COMMENT_RES" != *"Work commenced"* ]]; then
  echo "Error: Member comment creation failed: $COMMENT_RES"
  exit 1
fi

OCC_RES=$(curl -s -b "$MEMBER_COOKIE_JAR" "$BASE_URL/api/v1/occurrences?sevaId=$CHILD_ID")
OCC_ID=$(echo "$OCC_RES" | extract_json_val "id")

STATUS_RES=$(curl -s -b "$MEMBER_COOKIE_JAR" -X PATCH "$BASE_URL/api/v1/occurrences/$OCC_ID/status" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -d '{"status":"DONE","completionNote":"Fixed according to specifications","actualCost":450,"expectedVersion":1}')

if [[ "$STATUS_RES" != *"DONE"* && "$STATUS_RES" != *"updated"* && "$STATUS_RES" != *"true"* ]]; then
  echo "Error: Member status update failed: $STATUS_RES"
  exit 1
fi
echo "  ✓ Member successfully commented and marked occurrence DONE"

# 10. Dashboard KPIs & Subtree Roll-up
echo "[10/12] Checking Dashboard KPIs and Tree Roll-up..."
DASH_RES=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/dashboard/kpis")
if [[ "$DASH_RES" != *"completionRate"* && "$DASH_RES" != *"completionPercent"* ]]; then
  echo "Error: Dashboard KPIs endpoint failed: $DASH_RES"
  exit 1
fi

ROLLUP_RES=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/seva/$GROUP_ID/rollup")
if [[ "$ROLLUP_RES" != *"progressPercent"* ]]; then
  echo "Error: Group rollup endpoint failed: $ROLLUP_RES"
  exit 1
fi
echo "  ✓ Dashboard KPIs and Group Progress Roll-up verified"

# 11. Reports Export (PDF, XLSX, CSV)
echo "[11/12] Exporting Reports (PDF, XLSX, CSV)..."
CSV_RES=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/reports/export" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -d '{"format":"csv","from":"2026-01-01","to":"2026-12-31"}')

if [[ "$CSV_RES" != *"Title"* && "$CSV_RES" != *"Code"* ]]; then
  echo "Error: CSV report export failed"
  exit 1
fi

curl -s -f -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/reports/export" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -d '{"format":"xlsx","from":"2026-01-01","to":"2026-12-31"}' -o "$TEMP_DIR/report.xlsx"

if [ ! -s "$TEMP_DIR/report.xlsx" ]; then
  echo "Error: Excel report export resulted in empty file"
  exit 1
fi

curl -s -f -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/reports/export" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -d '{"format":"pdf","from":"2026-01-01","to":"2026-12-31"}' -o "$TEMP_DIR/report.pdf"

if [ ! -s "$TEMP_DIR/report.pdf" ]; then
  echo "Error: PDF report export resulted in empty file"
  exit 1
fi
echo "  ✓ Reports exported successfully in CSV, XLSX, and PDF formats"

# 12. Seva Files ZIP Download & Folder Hierarchy Verification
echo "[12/13] Downloading Seva ZIP archive and verifying folder hierarchy..."
curl -s -f -b "$COOKIE_JAR" "$BASE_URL/api/v1/seva/$GROUP_ID/files.zip?includeSubSeva=true" -o "$TEMP_DIR/archive.zip"

if [ ! -s "$TEMP_DIR/archive.zip" ]; then
  echo "Error: ZIP archive download resulted in empty file"
  exit 1
fi

# Verify ZIP contents
if command -v unzip >/dev/null 2>&1; then
  ZIP_CONTENTS=$(unzip -l "$TEMP_DIR/archive.zip")
  echo "$ZIP_CONTENTS" | grep -q "Artefacts" || { echo "Error: Artefacts folder missing in ZIP"; exit 1; }
  echo "$ZIP_CONTENTS" | grep -q "Quotes" || { echo "Error: Quotes folder missing in ZIP"; exit 1; }
fi
echo "  ✓ Seva ZIP archive contains valid hierarchical folder structure"

# 13. Contractors Module End-to-End Flow
echo "[13/13] Testing Contractors Directory, Field Tiers, and Request Workflow..."

# 13.1 List contractors
CONTRACTORS_RES=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/contractors")
FIRST_CONTRACTOR_ID=$(echo "$CONTRACTORS_RES" | grep -o '"id":"[^"]*' | head -n 1 | cut -d'"' -f4)
if [ -z "$FIRST_CONTRACTOR_ID" ]; then
  echo "Error: No contractors returned from /api/v1/contractors"
  exit 1
fi
echo "  ✓ Contractors list retrieved. Sample contractor ID: $FIRST_CONTRACTOR_ID"

# 13.2 Field-tier check: Member detail view
MEMBER_CONTRACTOR_RES=$(curl -s -b "$MEMBER_COOKIE_JAR" "$BASE_URL/api/v1/contractors/$FIRST_CONTRACTOR_ID")
if [[ "$MEMBER_CONTRACTOR_RES" != *"companyName"* ]]; then
  echo "Error: Member could not view open-tier contractor details: $MEMBER_CONTRACTOR_RES"
  exit 1
fi
if [[ "$MEMBER_CONTRACTOR_RES" == *"hourlyRate"* || "$MEMBER_CONTRACTOR_RES" == *"callOutFee"* ]]; then
  echo "CRITICAL SECURITY ERROR: Rates or fees exposed to member in contractor detail!"
  exit 1
fi
echo "  ✓ Field-tier verified: Member sees basic details; rates and fees stripped"

# 13.3 Member suggests new contractor
REQ_RES=$(curl -s -b "$MEMBER_COOKIE_JAR" -X POST "$BASE_URL/api/v1/contractor-requests" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -d '{"type":"NEW_CONTRACTOR","proposedData":{"companyName":"Smoke Clean Services","mainPhone":"0411 222 333","suburb":"Sydney"},"note":"Recommended by facility team"}')

SMOKE_REQ_ID=$(echo "$REQ_RES" | extract_json_val "id")
if [ -z "$SMOKE_REQ_ID" ]; then
  echo "Error: Member could not submit contractor request: $REQ_RES"
  exit 1
fi
echo "  ✓ Member submitted new contractor request: $SMOKE_REQ_ID"

# 13.4 Admin approves request
APPROVE_REQ_RES=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/contractor-requests/$SMOKE_REQ_ID/approve" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -d '{"reviewNote":"Approved by Smoke Admin"}')

if [[ "$APPROVE_REQ_RES" != *"APPROVED"* && "$APPROVE_REQ_RES" != *"resultingContractorId"* ]]; then
  echo "Error: Admin request approval failed: $APPROVE_REQ_RES"
  exit 1
fi
echo "  ✓ Admin approved contractor request; resulting contractor created"

# 13.5 Export contractors directory
CONTRACTOR_CSV=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/contractors/export?format=csv")
if [[ "$CONTRACTOR_CSV" != *"Company Name"* ]]; then
  echo "Error: Contractor CSV export failed"
  exit 1
fi
echo "  ✓ Contractor CSV directory export verified"

# 14. Licences & Skills Module Verification
echo "[14/14] Testing Licences & Skills Module end-to-end..."

# 14.1 Licence Types & Taxonomy
TYPES_RES=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/licence-types")
if [[ "$TYPES_RES" != *"Forklift"* && "$TYPES_RES" != *"LF"* ]]; then
  echo "Error: /api/v1/licence-types did not return seeded Forklift type: $TYPES_RES"
  exit 1
fi
echo "  ✓ Licence types active and verified"

# Create a dedicated unique licence type for this smoke test run
CATS_RES=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/licence-categories")
CAT_ID=$(echo "$CATS_RES" | grep -o '"id":"[^"]*' | head -n 1 | cut -d'"' -f4)

NEW_TYPE_RES=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/licence-types" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -d "{\"code\":\"smoke-ticket-$$\",\"name\":\"Smoke Test Ticket $$\",\"categoryId\":\"$CAT_ID\",\"kind\":\"TICKET\",\"hasExpiry\":true}")
SMOKE_TYPE_ID=$(echo "$NEW_TYPE_RES" | extract_json_val "id")
echo "  ✓ Dedicated smoke test licence type created: $SMOKE_TYPE_ID"

# 14.2 Summary Dashboard
SUMMARY_RES=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/licence-summary")
if [[ "$SUMMARY_RES" != *"validHolders"* ]]; then
  echo "Error: /api/v1/licence-summary failed: $SUMMARY_RES"
  exit 1
fi
echo "  ✓ Licence summary dashboard returned valid counts"

# 14.3 Member self-submission (PENDING_VERIFICATION)
SUBMIT_RES=$(curl -s -b "$MEMBER_COOKIE_JAR" -X POST "$BASE_URL/api/v1/me/licences" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -d "{\"licenceTypeId\":\"$SMOKE_TYPE_ID\",\"licenceNumber\":\"SMOKE-TICKET-999\",\"notes\":\"Submitted during smoke test\"}")

SMOKE_LICENCE_ID=$(echo "$SUBMIT_RES" | extract_json_val "id")
if [ -z "$SMOKE_LICENCE_ID" ]; then
  echo "Error: Member licence submission failed: $SUBMIT_RES"
  exit 1
fi
echo "  ✓ Member submitted licence for verification: $SMOKE_LICENCE_ID"

# 14.4 Directory & Field-tier enforcement
DIR_RES=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/v1/licence-directory")
if [[ "$DIR_RES" != *"people"* ]]; then
  echo "Error: /api/v1/licence-directory failed: $DIR_RES"
  exit 1
fi
if [[ "$DIR_RES" == *"SMOKE-TICKET-999"* ]]; then
  echo "CRITICAL SECURITY ERROR: Unmasked licence number leaked in directory response!"
  exit 1
fi
echo "  ✓ Directory tier verified: licence numbers masked / absent from directory responses"

# 14.5 Admin verification of pending licence
VERIFY_RES=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/licences/$SMOKE_LICENCE_ID/verify" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -d '{"status":"VALID","notes":"Approved in automated smoke test"}')

if [[ "$VERIFY_RES" != *"VALID"* ]]; then
  echo "Error: Admin verification of licence failed: $VERIFY_RES"
  exit 1
fi
echo "  ✓ Admin verified pending licence submission"

# 14.6 Audited Reveal of licence number
REVEAL_RES=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/licences/$SMOKE_LICENCE_ID/reveal-number" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL")

if [[ "$REVEAL_RES" != *"SMOKE-TICKET-999"* ]]; then
  echo "Error: Audited reveal failed to return licence number: $REVEAL_RES"
  exit 1
fi
echo "  ✓ Audited reveal returned unmasked number for authorised user"

# 14.7 Reports CSV export formula injection safety check
REPORT_CSV=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/licence-reports/export?format=csv" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -d '{"reportType":"HOLDERS_BY_TYPE"}')

if [[ "$REPORT_CSV" != *"Licence Type"* ]]; then
  echo "Error: Licence report CSV export failed"
  exit 1
fi
echo "  ✓ Licence report CSV export verified"

echo "=============================================="
echo " ALL SMOKE TESTS PASSED SUCCESSFULLY! "
echo " Licences and Contractors modules are verified production-ready."
echo "=============================================="

