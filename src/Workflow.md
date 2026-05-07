# Procurement Workflow Logic Documentation

This document describes the end-to-end logic of the Store FMS procurement system, exactly as it appears in the application sidebar. It explains how records move through each stage using "Planned" and "Actual" timestamps and status filters.

---

## 1. Create Indent
**Sidebar Name**: Create Indent  
**View**: `CreateIndent.tsx`  
**Database Table**: `indent`

- **Action**: User submits a new indent request.
- **Trigger**: Upon insertion, `planned1` (Creation Timestamp) is set automatically, making the record visible in the next stage.
- **Move to Next**: Visible in "Department Indent Approval".

---

## 2. Department Indent Approval
**Sidebar Name**: Department Indent Approval  
**View**: `ApproveIndent.tsx`  
**Database Table**: `indent`

- **Filter Logic**: `planned1` IS NOT NULL AND `actual1` IS NULL.
- **Action**: HOD/Admin approves the quantity and sets the vendor type.
- **Updates**:
  - `actual1`: Completion timestamp.
  - `planned2`: Trigger for Vendor Update.
- **Move to Next**: Visible in "Vendor Rate Update".

---

## 3. Vendor Rate Update
**Sidebar Name**: Vendor Rate Update  
**View**: `VendorUpdate.tsx`  
**Database Table**: `indent`

- **Filter Logic**: `planned2` IS NOT NULL AND `actual2` IS NULL.
- **Action**: Procurement gathers 3 quotations and payment terms.
- **Updates**:
  - `actual2`: Completion timestamp.
  - `planned3`: Trigger for Technical Approval (if 'Three Party').
  - `planned4`: Trigger for Management Approval (if 'Regular').
- **Move to Next**: Visible in "Department Approval" or "Management Approval".

---

## 4. Department Approval
**Sidebar Name**: Department Approval  
**View**: `TechnicalApproval.tsx`  
**Database Table**: `indent`

- **Filter Logic**: `planned3` IS NOT NULL AND `actual3` IS NULL.
- **Action**: Technical team ranks vendors (T1, T2, T3) based on specs.
- **Updates**:
  - `actual3`: Completion timestamp.
  - `planned4`: Trigger for Management Approval.
- **Move to Next**: Visible in "Management Approval".

---

## 5. Management Approval
**Sidebar Name**: Management Approval  
**View**: `RateApproval.tsx`  
**Database Table**: `indent`

- **Filter Logic**: `planned4` IS NOT NULL AND `approved_vendor_name` IS NULL.
- **Action**: Management selects the final vendor and terms.
- **Updates**:
  - `actual4`: Completion timestamp.
  - `planned5`: Trigger for PO Creation.
- **Move to Next**: Visible in "Pending PO to be Created" and "Create PO".

---

## 6. Pending PO to be Created
**Sidebar Name**: Pending PO to be Created  
**View**: `PendingPo.tsx`  
**Database Table**: `indent`

- **Filter Logic**: `poRequred === 'Yes'` AND `pendingPoQty > 0` AND NOT linked to a PO.
- **Purpose**: Dashboard to track indents that still need partial or full PO issuance.

---

## 7. Create PO
**Sidebar Name**: Create PO  
**View**: `CreatePO.tsx`  
**Database Table**: `po_master` & `indent`

- **Action**: Formal PO is created and linked to the indents.
- **Updates**:
  - Inserts into `po_master`.
  - Updates `indent`: `po_number` set, `actual5` set.
- **Move to Next**: Visible in "Lifting".

---

## 8. Lifting
**Sidebar Name**: Lifting  
**View**: `GetLift.tsx`  
**Database Table**: `store_in` (New entries) & `po_master` (Reference)

- **Filter Logic**: `liftingStatus === 'Pending'` in `po_master` or `indent`.
- **Action**: Marking material as "Lifted" from the vendor.
- **Key Field**: `bill_status` ('Bill Received' or 'Not Received').
- **Parallel Movement**: 
  - Triggers `planned6` for "Store Check".
  - If bill is missing, triggers `planned11` for "Bill Not Received".

---

## 9. Store Check
**Sidebar Name**: Store Check  
**View**: `StoreIn.tsx`  
**Database Table**: `store_in`

- **Filter Logic**: `planned6` IS NOT NULL AND `actual6` IS NULL.
- **Action**: Physical warehouse receipt, quantity/damage check.
- **Updates**: 
  - `actual6`: Receipt timestamp.
  - `plannedHod`: Trigger for HOD sign-off.
- **Move to Next**: Visible in "HOD Check".

---

## 10. HOD Check
**Sidebar Name**: HOD Check  
**View**: `HodStoreApproval.tsx`  
**Database Table**: `store_in`

- **Filter Logic**: `plannedHod` IS NOT NULL AND `actualHod` IS NULL.
- **Action**: HOD verifies the received items and marks as 'Approved' or 'Rejected'.
- **Updates**:
  - `actualHod`: Completion timestamp.
  - `hodStatus`: 'Approved' (Moves to Payment) or 'Rejected' (Moves to Reject For GRN).

---

## 11. Bill Not Received
**Sidebar Name**: Bill Not Received  
**View**: `BillNotReceived.tsx`  
**Database Table**: `store_in`

- **Filter Logic**: `planned11` IS NOT NULL AND `actual11` IS NULL.
- **Action**: Uploading bills that were missing during lifting. Runs parallel to Store Check.

---

## 12. Reject For GRN
**Sidebar Name**: Reject For GRN  
**View**: `QuantityCheckInReceiveItem.tsx`  
**Database Table**: `store_in`

- **Filter Logic**: `planned7 !== ''` AND `actual7 === ''` AND `hodStatus === 'Rejected'`.
- **Action**: Processing items that failed the HOD check for return or debit note initiation.

---

## 13. Send Debit Note
**Sidebar Name**: Send Debit Note  
**View**: `SendDebitNote.tsx`  
**Database Table**: `store_in`

- **Filter Logic**: `planned9 !== ''` AND `actual9 === ''`.
- **Action**: Issuing a formal debit note to the vendor for rejected goods.

---

## 14. Freight Payment
**Sidebar Name**: Freight Payment  
**View**: `FullKiting.tsx`  
**Database Table**: `fullkitting`

- **Action**: Managing and paying logistics/transportation charges.

---

## 15. Process for Payment / Debit Note
**Sidebar Name**: Process for Payment / Debit Note  
**View**: `PaymentStatus.tsx`  
**Database Table**: `po_master`, `payments`, `store_in`

- **Filter Logic**: 
  - Material received (`actual6` set).
  - HOD Approved (`hodStatus === 'Approved'`).
  - Bill Type is 'Independent'.
- **Action**: Grouping bills by Vendor and initiating the payment schedule.
- **Next Stage**: Visible in "Make Payment".

---

## 16. Make Payment
**Sidebar Name**: Make Payment  
**View**: `MakePayment.tsx`  
**Database Table**: `payments` & `payment_history` (inserts)

- **Filter Logic**: `planned` IS NOT NULL AND `status !== 'Completed'`.
- **Action**: Accounts team schedules and confirms the bank transaction.
- **Updates**: Moves record to history and triggers the final entry logic.

---

## 17. Audit Data
**Sidebar Name**: Audit Data  
**View**: `AuditData.tsx`  
**Database Table**: `tally_entry`

- **Filter Logic**: `planned1` IS NOT NULL AND `actual1` IS NULL.
- **Action**: Multi-stage final audit verification before Tally entry.
- **Multi-Stage Workflow (Sub-tabs)**:
  1.  **Initial Audit**: Verifying paperwork (`planned1`).
  2.  **Rectify Mistake**: Correcting errors (`planned2`).
  3.  **Reaudit**: Second check after correction (`planned3`).
  4.  **Tally Entry**: Final data entry in ERP (`planned4`).
  5.  **Again Audit**: Final post-entry validation (`planned5`).

---

## Database Implementation Summary

| Sidebar Section | Primary Table | Key Visibility Trigger | Completion Field |
| :--- | :--- | :--- | :--- |
| **Create Indent** | `indent` | Entry Creation | `planned1` |
| **Dept Indent Approval** | `indent` | `planned1` | `actual1` |
| **Vendor Rate Update** | `indent` | `planned2` | `actual2` |
| **Department Approval** | `indent` | `planned3` | `actual3` |
| **Management Approval** | `indent` | `planned4` | `approved_vendor_name` |
| **Create PO** | `po_master` | `planned5` | `actual5` |
| **Lifting** | `store_in` | PO Quantities | `timestamp` |
| **Store Check** | `store_in` | `planned6` | `actual6` |
| **HOD Check** | `store_in` | `plannedHod` | `actualHod` |
| **Bill Not Received** | `store_in` | `planned11` | `actual11` |
| **Reject For GRN** | `store_in` | `planned7` & `hodStatus`=Rejected | `actual7` |
| **Send Debit Note** | `store_in` | `planned9` | `actual9` |
| **Process for Payment** | `payments` | HOD Approval + Receipt | `planned` |
| **Make Payment** | `payments` | `planned` | `actual` |
| **Audit Data** | `tally_entry` | `planned1` | `actual1` |
