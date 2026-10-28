# LICENCES AND SKILLS MODULE USER GUIDE

This user guide explains how to manage, search, verify, and report on organizational licences, tickets, certificates, and competencies within the Seva Maintenance Management System.

---

## 1. Overview and Core Rules

The **Licences and Skills** module provides a central register of who holds which licence or ticket (Forklift, Elevated Work Platform, White Card, First Aid, CPR, Working at Heights, Electrical, Heavy Vehicle, Driver Licence, WWCC, Police Check, and more).

Key operational principles:
1. **Zero Recurring Cost & 100% Offline**: Everything runs self-hosted without external verification lookups or third-party cloud services.
2. **Quad-Tier Privacy**:
   - **Directory Tier**: Name, avatar, licence type, class, validity status badge, expiry month/year, and availability. No licence numbers, exact issue/expiry dates, conditions, or files are visible.
   - **Contact Tier**: Adds phone number and email for direct contact.
   - **Sensitive Tier**: Displays exact issue and expiry dates, conditions, restrictions, and internal notes. Licence numbers remain masked (`••••• 194`) by default until an explicit, audited **Reveal** is performed.
   - **Documents Tier**: Grants access to inspect and download verified document scans.
3. **Highly Sensitive Isolation**: Working with Children Checks (WWCC), Police Checks, and Driver Licences are marked `isHighlySensitive = true`. Their numbers and documents are visible *only* to the holder and users with both sensitive and document viewing permissions; they are strictly excluded from bulk exports and ZIP archives.
4. **Canonical Definition of a Holder**: A person is counted as a "holder" if they are an active user with a non-archived, non-superseded licence in `VALID` or `EXPIRING_SOON` status, with verification completed. Unverified self-submissions remain pending until verified.

---

## 2. Guide for Everyone (Members & All Users)

### 2.1 My Licences
Access your personal licence dashboard by navigating to **Licences** in the sidebar (or via your User Profile):
- **Licence Cards**: Review all tickets and competencies registered under your profile, complete with countdowns and status indicators (Green = Valid, Amber = Expiring Soon, Red = Expired / Pending).
- **Masked Numbers**: Click the **Reveal** button next to any licence number to view the unmasked number. This action is recorded in your personal activity history.
- **View Scans**: Click the document link or thumbnail to review the front/back scans uploaded for that credential.

### 2.2 Submitting a New Licence for Verification
If you hold a licence or ticket that has not yet been registered:
1. Navigate to **Licences** > **My Licences** tab.
2. Click **+ Submit Licence**.
3. Select the **Licence Type** from the dropdown (e.g. *Elevated Work Platform (EWP)* or *First Aid*).
4. If the licence requires a class (e.g. *Over 11m*, *LF*), select or enter the class.
5. Enter your **Licence Number**, **Issuing Body**, **Issue Date**, and **Expiry Date** (if applicable).
6. Upload photos or scans of the front and back of the physical ticket using your device camera or file picker (supported formats: JPG, PNG, WebP, PDF).
7. Submit the form. Your submission enters `PENDING_VERIFICATION` status with source `SELF_SUBMITTED`. It will not count toward organizational holder targets until verified by an Administrator.

### 2.3 Renewing an Expiring Licence
When a ticket is approaching expiry or has expired:
1. On your licence card, click **Renew**.
2. Upload the updated ticket scan and confirm the new expiry date and details.
3. A new submission is created and linked to the existing record. The prior record remains active until the renewal is verified, ensuring continuous coverage history without duplication.

### 2.4 Managing Your Availability
To ensure you are only contacted or scheduled for volunteer duties when available:
1. At the top of **My Licences**, locate the **Availability** banner.
2. Select your status:
   - **Available**: Ready and willing to take on assignments.
   - **Limited**: Available with constraints (e.g., weekends only, mornings only).
   - **Unavailable**: Temporarily unavailable.
3. Optional: Add a short explanatory note (up to 200 characters) and set an **Available Until** date to automatically revert status when your current schedule ends.

---

## 3. Guide for Coordinators

### 3.1 Licence Directory
The **Licence Directory** provides a searchable roster of qualified members:
- **Search by Alias & Name**: Search for "EWP", "forklift", "ticket", or specific volunteer names. Aliases are automatically indexed for instant lookup.
- **Filter Chips**: Filter by Category, Licence Type, Class, Status (`VALID`, `EXPIRING_SOON`, etc.), Expiry Horizon (30, 60, 90 days), and Current Availability.
- **Multi-Skill Filtering**: Use the **Has All Of** filter to locate individuals holding multiple credentials simultaneously (e.g. *Forklift* AND *Working at Heights*).
- **Target Date Validity**: Specify a future date to identify who will possess a valid licence on that exact date.
- **Direct Contact**: Users with `licences.directory.contact` permission can click the **Call** or **Email** buttons directly from cards or table rows.

### 3.2 Finding Eligible Volunteers (`Find Volunteers`)
When organizing a maintenance project or working bee:
1. Go to **Licences** > **Find Volunteers** tab.
2. Pick the required licence types and optional classes.
3. Select the target **Date** (defaults to today).
4. Choose whether to restrict results to **Available Only**.
5. The system ranks eligible candidates using a deterministic 4-stage algorithm:
   - **Full Qualification Match**: Holds all required licences valid on that date.
   - **Availability Tier**: `AVAILABLE` volunteers rank ahead of `LIMITED`.
   - **Workload Balance**: Prioritizes individuals with fewer assigned open tasks in the next 7 days.
   - **Validity Longevity**: Candidates with the greatest remaining validity days rank higher.
6. Click **Copy List** to grab the roster or assign directly to an upcoming Seva task.

### 3.3 Seva Task Licence Requirements
When creating or editing a Seva task that involves specialized machinery or hazardous operations:
1. In the Seva form, open the **Required Licences** section.
2. Add one or more required licence types, minimum required holders, and optional class restrictions.
3. When selecting assignees:
   - Candidates holding the required valid credential display a green check badge.
   - Candidates lacking the credential display an amber warning badge.
   - Toggle **Only show eligible people** to filter the candidate list immediately.
4. On the Seva detail view, the **Licence Check Banner** displays real-time compliance status (e.g., *"Requirements met by 2 of 2 assignees"* or *"Nobody assigned holds Forklift (valid on 12 Nov)"*).
5. Depending on the organizational enforcement setting (`licenceEnforcement`):
   - **WARN**: The assigner must confirm before assigning an uncertified person; the confirmation is logged.
   - **BLOCK**: Only an Administrator can override the restriction with a mandatory logged reason.

---

## 4. Guide for Administrators

### 4.1 Verification Queue
When members submit or renew licences, they appear in the **Verification Queue**:
1. Navigate to **Licences** > **Verification Queue**.
2. Select a pending submission to open the side-by-side verification dialog.
3. Compare the entered licence number, dates, and class against the document preview.
4. Actions:
   - **Verify**: Marks the record `VALID` (or `EXPIRING_SOON` if nearing cutoff), stamps `verifiedBy` and `verifiedAt`, and notifies the holder.
   - **Edit & Verify**: Correct typos in licence numbers or dates, then verify in one step.
   - **Reject**: Enter a mandatory reason (e.g. *"Illegible photo, please re-upload clear image of card back"*). The submitter is notified to re-submit.

### 4.2 Managing Licence Types and Targets
Navigate to **Licences** > **Licence Types**:
- **Master Taxonomy**: Add or edit licence types across categories (Plant & Equipment, Working at Heights, Electrical & Trades, etc.).
- **Aliases & Classes**: Configure search aliases (e.g., "LF", "Yellow Card") and allowed classes (e.g., "LF", "Over 11m").
- **Target Thresholds (`minHoldersTarget`)**: Set the minimum required valid holders the organisation aims to maintain. Types falling below this target are flagged in red on dashboards and alert administrators weekly.
- **Sensitivity Flags**: Mark credentials as `isHighlySensitive` (Driver Licence, WWCC, Police Check) to enforce strict isolation.

### 4.3 CSV Import & Bulk Onboarding
To import historical registers or external spreadsheets:
1. Go to **Licences** > **Import** tab.
2. Download the CSV template containing standard column headers (`email`, `licenceType`, `class`, `licenceNumber`, `issuer`, `issuedAt`, `expiresAt`, `conditions`).
3. Upload your CSV (up to 2,000 rows / 2 MB).
4. Review the **Validation Preview**:
   - The preview highlights row-by-row syntax errors, unmatched user emails, and unrecognized licence type slugs.
5. Click **Commit Import**: Executes an all-or-nothing database transaction ensuring zero partial or corrupted imports.

### 4.4 Reports and Compliance Audits
Navigate to **Reports** > **Licences**:
1. **Holders by Licence Type**: Filterable counts and member names.
2. **Expiry Horizon Report**: Upcoming expirations within 30, 60, or 90 days.
3. **Licence Matrix**: Interactive grid of members against licence types with colored status pills.
4. **Gap Analysis**: Shortfalls against organizational `minHoldersTarget`.
5. **Seva Compliance Audit**: Verification of whether past and upcoming tasks met required tickets.
6. **Weekly Trends**: 12-week longitudinal chart of active, expiring, and pending tickets.
7. *Export Security*: CSV and Excel exports automatically sanitize all cells against formula injection (`neutralizeFormula`), and exclude highly sensitive numbers.

---

## 5. Automated Background Worker Jobs

The maintenance worker daemon runs four automated tasks:
1. **`refreshLicenceStatus`** (Daily, 02:45): Recomputes `VALID`, `EXPIRING_SOON`, and `EXPIRED` states based on `expiresAt` and `licenceExpiryWarnDays` (default 30 days). Automatically reverts expired `UserAvailability` windows.
2. **`scheduleLicenceReminders`** (Daily): Creates deduplicated reminder notifications at 60, 30, 7, and 0 days prior to expiry for both holders and licence managers.
3. **`licenceSnapshot`** (Weekly): Records historical holder counts into `LicenceCountSnapshot` to power analytics sparklines and gap reports.
4. **`checkUpcomingSevaLicences`** (Daily): Scans upcoming Seva occurrences within the next 14 days and notifies coordinators if an assigned member's licence will lapse before the task date.

---

## 6. Permissions and Access Control Reference

| Permission Key | Description | Default Grants |
| :--- | :--- | :--- |
| `licences.own.view` | View personal licences, numbers, and uploaded files | MEMBER, COORDINATOR, ADMIN |
| `licences.own.submit` | Submit new licences, upload renewal scans, edit availability | MEMBER, COORDINATOR, ADMIN |
| `licences.directory.view` | Search directory, view summaries, matrix, and holder lists (no numbers or files) | COORDINATOR, ADMIN |
| `licences.directory.contact` | View email and phone numbers in directory and find-volunteer roster | COORDINATOR, ADMIN |
| `licences.manage` | Add, edit, suspend, revoke, and archive licences for other users | ADMIN (Optional: COORDINATOR) |
| `licences.verify` | Approve or reject pending self-submissions in the queue | ADMIN (Optional: COORDINATOR) |
| `licences.sensitive.view` | View unmasked licence numbers and exact validity dates | ADMIN |
| `licences.documents.view` | Open and stream document scans of other users | ADMIN |
| `licences.types.manage` | Manage master licence types, categories, and targets | ADMIN |
| `licences.seva.require` | Attach mandatory licence requirements to Seva tasks | COORDINATOR, ADMIN |
| `licences.reports.view` | Run and export licence compliance and summary reports | COORDINATOR, ADMIN |
| `licences.import` | Upload and commit bulk CSV licence records | ADMIN |
