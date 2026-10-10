# Issue 14 — Public-Facing Marketing Website, Documentation & Legal Compliance

## Metadata
- **Severity**: P1 (Launch Requirement)
- **Status**: ✅ Resolved & Verified
- **Category**: Public Website, Product Marketing, Legal Compliance (DPDP Act), SEO & Help Center
- **Date**: October 10, 2026

---

## 1. Problem Statement
The current frontend application exposes only internal authenticated routes, login/register forms, and a raw consignment tracking URL. There is no public marketing website or legal transparency layer:
1. **Unwelcoming Landing Route**: Unauthenticated visitors navigating to the root URL (`/`) are immediately bounced to `/login` without seeing what Fleet Flow is, who it is for, or why they should register.
2. **Missing Product & Feature Explanations**: Prospective fleet owners cannot explore how dispatch, 3-part LRs, fuel slips, or driver settlements work before signing up.
3. **No Public Pricing Transparency**: Prospects cannot view tier pricing, vehicle quotas, add-ons, or trial policies prior to creating an account.
4. **No Demo Request or Sales Contact Flow**: Large fleet operators (50+ trucks) who require enterprise agreements, multi-branch setups, or custom onboarding have no demo booking or sales inquiry form.
5. **No Public Help Center & Documentation**: There are no self-service setup tutorials, FAQs, or troubleshooting guides for new operators.
6. **Absence of Statutory Legal Pages**: For commercial payments and Indian DPDP compliance, the platform requires enforceable Terms of Service, Privacy Policy (DPDP Act 2023), and Subscription/Cancellation/Refund Policies.
7. **No Trust & Security or System Status Pages**: Enterprise customers demand transparency regarding data isolation, encryption, backup objectives, and platform uptime status.
8. **Lack of SEO & Semantic Metadata**: The public shell lacks OpenGraph social preview tags, descriptive page titles, meta descriptions, XML sitemaps, and WCAG accessibility.

---

## 2. Root Cause Analysis (RCA)
- **Focus on Core ERP Application**: Development prioritized authenticated transactional workflows (trips, LRs, invoices, ledgers) over public top-of-funnel customer acquisition pages.
- **Root Router Redirection**: `App.tsx` mapped root `/` directly to `<IndexRedirect />` which navigates to `/dashboard` or `/login`.

---

## 3. Implementation Solution & Target Architecture

### A. Public Layout & Marketing Design System (`PublicLayout.tsx`)
- Lightweight responsive marketing shell:
  - Header: Fleet Flow brand logo, navigation links (Features, Pricing, Security, Help, Contact), "Sign In" button, and prominent CTA **"Start Free 14-Day Trial"**.
  - Footer: Product links, Legal pages, Company contact, Indian GST compliance badge, social channels, copyright.

### B. Core Marketing Pages
1. **Home Page (`/`)**:
   - Hero Section: "The Modern Operating System for Indian Fleet & Transport Operators."
   - Visual Fleet OS interactive mockup highlighting real-time trip dispatches and LR generator.
   - Core Value Pillars:
     - Digital Compliance Vault (Zero RTO penalties).
     - 3-Part Consignment Lorry Receipts (Instant WhatsApp & PDF).
     - Driver Settlement Engine (End fuel leakage & advance disputes).
     - GST Freight Invoicing & Automatic TDS Ledger.
   - Transporter Savings Calculator: Interactive slider estimating monthly diesel and billing hours saved.
   - Primary Call to Action: 14-day full-access trial, no credit card required.
2. **Features Page (`/features`)**:
   - Deep dive into verified platform modules:
     - Fleet & Driver Master (Compliance alerts, Aadhaar masking).
     - Trip Dispatch & Market Vehicle Movements.
     - Lorry Receipts & Consignment Notes Engine.
     - GST Tax Invoicing & Accounts Receivable.
     - Driver Trip Settlement & Double-Entry Ledger.
3. **Public Pricing Page (`/pricing`)**:
   - Transparent 4-tier matrix: Starter, Standard Commercial, Pro Enterprise, Custom Enterprise.
   - Monthly vs Annual toggle (17% discount).
   - Clear resource limits (Max Trucks, Drivers, Team Seats) and included module checklists.
   - Modular Add-ons catalog breakdown (WhatsApp Suite, Fleet IQ Telematics, Capacity Boosters).
   - Transparent trial conditions: 14-day free trial on Standard tier, 7-day dunning grace period, no credit card required upfront.
4. **Demo Booking & Sales Contact Page (`/contact` / `/demo`)**:
   - Form fields: Name, Phone, Work Email, Company Name, Fleet Size (1–5, 6–20, 21–50, 50+), Primary operational pain point.
   - Submits inquiry to database (`LeadInquiry.ts`) and triggers WhatsApp/email alert to sales administrators.

### C. Help Center & Knowledge Base (`/help`)
- Searchable self-service portal:
  - **Getting Started**: 5-minute setup checklist.
  - **Operations**: How to book a trip, attach a market truck, generate an LR.
  - **Billing & GST**: Generating forward vs RCM invoices, applying TDS, recording receipts.
  - **Settlements**: Closing a driver trip, deducting advances, issuing payments.
  - FAQs on billing renewal, quota upgrades, and document uploads.

### D. Legal & Compliance Layer
1. **Terms of Service (`/terms`)**:
   - Commercial SaaS subscription agreement, acceptable usage rules, carrier vs platform liabilities, 99.9% uptime SLA commitments.
2. **Privacy Policy (`/privacy`)**:
   - Strict adherence to the Indian Digital Personal Data Protection (DPDP) Act 2023.
   - Details collection and processing of phone numbers, GSTINs, driver commercial licenses, and masked Aadhaar numbers.
3. **Subscription, Cancellation & Refund Policy (`/refund-policy`)**:
   - Proration terms, 7-day money-back guarantee on initial upgrades, cancellation procedure, and 30-day read-only data grace period before permanent account archival.

### E. Trust, Security & Status Pages
1. **Trust & Security (`/security`)**:
   - Explains tenant isolation via MongoDB AsyncLocalStorage scoping, 256-bit TLS encryption, field-level encryption for sensitive PII, daily automated backups, and 7-year statutory financial data retention.
2. **System Status (`/status`)**:
   - Real-time service uptime dashboard: API Engine, Web Application, Database Cluster, Payment Gateway, and Notification Delivery.
   - Incident history and maintenance announcements.

### F. SEO, OpenGraph & Accessibility
- **Metadata**:
  - Semantic `<title>` and `<meta name="description">` on every page.
  - OpenGraph social media preview cards (`og:image`, `og:title`, `og:description`).
  - Auto-generated `sitemap.xml` and `robots.txt`.
- **Accessibility**:
  - WCAG 2.1 AA compliant color contrast ratios.
  - Full keyboard focus navigation and ARIA attributes on interactive tabs and modals.

---

## 4. Files to be Modified / Created
| File | Planned Changes |
| :--- | :--- |
| `frontend/src/components/layout/PublicLayout.tsx` | Responsive marketing shell with brand header and corporate footer |
| `frontend/src/pages/marketing/HomePage.tsx` | Modern SaaS landing page with hero, value pillars, and ROI calculator |
| `frontend/src/pages/marketing/FeaturesPage.tsx` | Comprehensive feature tour covering core transport and finance modules |
| `frontend/src/pages/marketing/PublicPricingPage.tsx` | Public pricing tiers, quota allowances, and add-on catalog |
| `frontend/src/pages/marketing/ContactPage.tsx` | Demo booking and enterprise sales inquiry form |
| `frontend/src/pages/marketing/HelpCenterPage.tsx` | Searchable knowledge base with setup guides and operational FAQs |
| `frontend/src/pages/legal/TermsPage.tsx` | Statutory SaaS Terms of Service |
| `frontend/src/pages/legal/PrivacyPage.tsx` | Indian DPDP Act 2023 compliant Privacy Policy |
| `frontend/src/pages/legal/RefundPolicyPage.tsx` | Subscription, cancellation, and refund policy |
| `frontend/src/pages/marketing/SecurityTrustPage.tsx` | Enterprise trust, data protection, and encryption architecture |
| `frontend/src/pages/marketing/SystemStatusPage.tsx` | Live operational status indicator and incident log |
| `backend/src/models/LeadInquiry.ts` | Schema for storing sales leads and demo requests |
| `frontend/src/App.tsx` | Mount all public marketing and legal routes |

---

## 5. How to Test Manually on the Website (Step-by-Step UI Guide)

### Test 1: Browsing the Public Marketing Homepage as an Unauthenticated Visitor
1. **Open Root URL in Incognito**:
   - Open a fresh incognito window (no logged-in session).
   - Navigate to: `http://localhost:5173/`.
2. **What You Should See on the Screen**:
   - The public marketing homepage loads with navigation bar:
     - Links: *Features*, *Pricing*, *Company*, *Help Center*, *Sign In*.
     - Call-to-action button: *[Start 14-Day Free Trial]*.
   - Hero section with high-impact value proposition for Indian transporters:  
     *"Unified Fleet Dispatch, Consignments, GST Billing & Live GPS Tracking."*
   - Interactive Fleet ROI Calculator: drag the slider to 25 trucks to see estimated annual cost savings.
   - Comprehensive footer with statutory company links and contact information.

---

### Test 2: Comparing Pricing Tiers & Annual Billing Discounts
1. **Navigate to Public Pricing**:
   - Click the **"Pricing"** link in the top navigation bar (`http://localhost:5173/pricing`).
2. **Toggle Billing Cycle Switch**:
   - Toggle the switch from **"Monthly Billing"** to **"Annual (Get 2 Months Free)"**.
3. **What You Should See on the Screen**:
   - Pricing tier cards (Starter, Professional, Enterprise) update dynamically to show the discounted annual rates.
   - Feature checklists clearly specify included trucks, drivers, and module limits.
   - Click **"Get Started"** on the Professional tier card:
     - The browser navigates directly to the registration page (`/register?plan=pro`) with the Professional tier pre-selected.

---

### Test 3: Submitting an Enterprise Demo Request
1. **Open Demo Request Form**:
   - Click **"Book a Demo"** in the header (`http://localhost:5173/demo`).
2. **Fill Prospect Details**:
   - Full Name: `Vikram Singhania`
   - Company Name: `Singhania Logistics Pvt Ltd`
   - Work Email: `vikram@singhania.in`
   - Fleet Size: `50+ Trucks`
   - Notes: `Interested in GPS telematics integration and Tally accounting sync`.
   - Click **"Request Demo"**.
3. **What You Should See on the Screen**:
   - A success confirmation screen appears:  
     > 🎉 *"Thank you, Vikram! Our transport technology specialist will schedule your interactive walkthrough within 2 business hours."*
   - Form fields reset cleanly.

---

### Test 4: Inspecting Legal DPDP Disclosures & Live System Status
1. **Verify DPDP Privacy Disclosures**:
   - Click **"Privacy Policy"** in the footer (`http://localhost:5173/privacy`).
   - Verify the presence of statutory compliance clauses: India Digital Personal Data Protection (DPDP) Act 2023, Aadhaar data masking standards, and Data Protection Officer (DPO) contact email.
2. **Inspect System Status Dashboard**:
   - Click **"System Status"** in the footer (`http://localhost:5173/status`).
   - **What you should see**: A live status indicator:  
     > 🟢 *"All Systems Operational — 99.98% Uptime Over Last 90 Days"*  
     - Subsystem breakdown: Core Web App, WhatsApp Dispatch Webhooks, GPS Ingestion Engine, and Database Cluster.

