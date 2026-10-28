# Contractors Module User Guide: Central Contractor Directory

The **Contractors Module** provides a single, central directory of all approved tradespeople, service companies, and maintenance contractors utilized across the organisation. It balances universal visibility for all team members with strict governance and security controls for sensitive commercial terms and compliance credentials.

---

## The Golden Rule of Contractor Visibility & Governance

- **Everyone Can Read Identity & Health**: Every signed-in member can look up contractors, view contact details, trades, emergency phone numbers, average review ratings, and compliance health status badges (VALID, EXPIRING SOON, EXPIRED).
- **Commercial Details are Restricted**: Hourly rates, call-out fees, financial spend, coordinator internal notes, block reasons, and license registration numbers are strictly confidential to Coordinators and Admins.
- **Everyone Can Propose**: Any member can suggest a new contractor or propose an update to an existing contractor.
- **Coordinators & Admins Approve**: Proposals are never applied automatically; they enter a review queue for verification, side-by-side comparison, and atomic approval.

---

## 1. Member Guide

### 1.1. Finding a Contractor
1. Navigate to **Contractors** in the main navigation menu (or press the Contractors card on mobile).
2. Use the **Search bar** to search by company name, trading name, contact person, phone number, or suburb.
3. Apply filters:
   - **Trade**: Filter by specific trade (e.g. Plumbing, Electrical, HVAC, Landscaping).
   - **Preferred**: Show only preferred organisation partners.
   - **After-Hours**: Filter by contractors providing 24/7 or emergency support.
   - **Credential Health**: Filter for contractors with active, valid insurance.
4. On phone screens, tap **Call** (`tel:`) or **Email** (`mailto:`) to contact the contractor's primary representative directly.

### 1.2. Suggesting a New Contractor
When you encounter a reliable service provider not yet listed in the directory:
1. Tap the **Suggest Contractor** button in the Contractors directory.
2. Fill in the suggested company name, primary trades, contact details, and suburb.
3. Add a short note explaining why you recommend them (e.g., who referred them, past experience).
4. Optionally upload up to 3 supporting files (such as a business card photo or brochure).
5. As you type, the system automatically checks for near-duplicate names to prevent duplicate submissions.
6. Submit your request. It will be routed directly to the Coordinator review queue.

### 1.3. Suggesting a Change to an Existing Contractor
If a contractor changes their phone number, email, address, or trade offerings:
1. Open the contractor's profile page.
2. Tap the **Suggest Change** button in the header.
3. Edit only the fields that are outdated or incorrect.
4. Add a brief note detailing the reason for the update.
5. Submit the suggestion. Only the modified fields are tracked and submitted for review.

### 1.4. Tracking My Requests
1. Navigate to **Contractors > My Requests** (or `/contractors/requests/mine`).
2. Review the status of your proposals:
   - **OPEN**: Pending coordinator review. You can withdraw an open request at any time by pressing **Withdraw**.
   - **APPROVED**: Accepted by a coordinator and applied to the directory.
   - **PARTIALLY_APPROVED**: Reviewed where select proposed fields were accepted.
   - **REJECTED**: Declined with a written explanation from the reviewer.
3. You will receive an in-app notification immediately when a decision is made.

---

## 2. Coordinator & Admin Guide

### 2.1. Adding and Editing Contractors
Users with `contractors.write` capability can directly manage directory listings:
1. Click **Add Contractor** from the directory screen.
2. Fill out company details, trading names, registered ABN/ACN (automatically validated using Australian Tax Office checksums), addresses, and after-hours availability.
3. Assign registered trades and designate a primary trade.
4. Add primary and secondary contact persons.
5. Set commercial terms: payment terms (e.g., Net 14), hourly rates, and call-out fees (these commercial numbers are strictly hidden from members).
6. Press **Create Contractor** to publish. The system enforces optimistic concurrency locking on all updates.

### 2.2. Credentials, Licenses & Automated Reminders
Contractor compliance requires active licenses and insurance:
1. In the contractor's detail screen, open the **Credentials** tab.
2. Click **Add Credential** to record:
   - **Kind**: Licence, Insurance, Certification, or Other.
   - **Type**: e.g. Electrical Contractor Licence, Public Liability, Workers Compensation.
   - **Issuer / Insurer**, policy number, cover amount, and expiration date.
   - Attach digital certificate scans via the upload button.
3. Compliance status is derived automatically:
   - **VALID**: Expiration date is more than 30 days in the future.
   - **EXPIRING_SOON**: Expiration date falls within the warning horizon (default: 30 days).
   - **EXPIRED**: Expiration date has passed.
4. **Automated Reminders**: The background worker automatically schedules notifications at 60, 30, 7, and 0 days prior to expiration. If an expired contractor is assigned to a Seva task, a compliance warning modal requires coordinator confirmation before engagement.

### 2.3. Reviewing Contractor Requests
Coordinators and Admins with `contractors.requests.review` capability manage proposals:
1. Navigate to **Contractors > Review Queue** (`/contractors/requests`).
2. Open any **OPEN** request:
   - **New Contractor Requests**: Displays a prefilled profile form that coordinators can review, augment with commercial rates or credentials, and commit.
   - **Update Requests**: Shows a side-by-side comparison of current directory values versus proposed values with checkboxes for each field.
3. Actions:
   - **Approve All**: Applies all proposed changes atomically.
   - **Partially Approve**: Select specific fields to accept; unselected fields are discarded.
   - **Request More Info**: Prompts the proposer for clarification via notification.
   - **Reject**: Declines the request with a mandatory explanation.
4. **Conflict Detection**: If another user modified the contractor after the request was submitted, the system flags the version conflict and requires confirmation before applying changes.

### 2.4. Engaging Contractors on Seva Tasks
1. Open any Seva task detail screen and click the **Contractors** tab.
2. Click **Assign Contractor**:
   - The modal suggests top-matched contractors based on the Seva Category-to-Trade mapping.
   - Priority is given to preferred partners with valid insurance.
   - If a contractor is BLOCKED or has expired insurance, a safety override warning is presented and logged to the audit log upon confirmation.
3. Record engagement role (`PRIMARY`, `SUBCONTRACTOR`, `CONSULTANT`), quoted amounts, final amounts, and invoice details.
4. Approving a quote from a linked contractor automatically prompts to update their status to `ENGAGED`.

### 2.5. CSV Import & Quote Linking Tools
- **CSV Import Tool (`/contractors/import`)**:
  - Download the official CSV template.
  - Upload batch contractor records (up to 2,000 rows / 2 MB).
  - Inspect the validation preview with row-level error reporting, ABN validation, and duplicate name warnings before committing all-or-nothing in a single transaction.
- **Link Existing Quotes Tool (`/contractors/link-quotes`)**:
  - Scans historical Seva quote documents that possess a free-text `supplierName`.
  - Uses trigram similarity to suggest contractor matches.
  - Requires coordinator confirmation for each link; never links automatically.

### 2.6. Reports & Analytics
Generate PDF, Excel, and CSV reports:
1. **Directory Export**: Filtered list of contractors with open-tier data for members and full financial/credential data for coordinators.
2. **Credential Expiry Report**: Comprehensive listing of upcoming and overdue licenses across all contractors.
3. **Spend Report**: Aggregates quoted, final, and invoiced amounts by contractor, trade, and project subtree.
4. **Contractor Performance Report**: Tracks job volume, on-time delivery rates, and average star ratings.
5. **Printable PDF Profile**: Single-sheet summary of contractor credentials, contacts, and performance history.
