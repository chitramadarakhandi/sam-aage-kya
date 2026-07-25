# Verified fee research pilot

Checked on: 20 July 2026
Academic cycle represented: 2026-27

This pilot demonstrates the required evidence chain from an official circular to
a component-level fee calculation. It intentionally does not infer missing
semesters, later-year revisions, personal living costs or unconfirmed aid.

## Official sources

| Institution | Scope | Official notice | Notice date | SHA-256 |
|---|---|---|---|---|
| IIT Bombay | UG new entrant academic fees, Autumn 2026-27 | [Academic Section circular](https://acad.iitb.ac.in/sites/default/files/Fee_Circular_for_UG_New_Entrants_2026-2027_0.pdf) | 29 June 2026 | `dd840401a27aa8b4bd6613a5766059c8725b079a4e6232e3381b7c5b70275be9` |
| IIT Bombay | New UG hostel and mess fees, Autumn 2026-27 | [Hostel Coordinating Unit circular](https://acad.iitb.ac.in/sites/default/files/Hostel_Fee_Circular_New_UG_and_PG_Autumn_%202026-27.pdf) | 7 May 2026 | `2dd41e1aa5f08470e158fc3e325e961e72323088bd866fb5d6ebcb129bd04df7` |
| NITK Surathkal | B.Tech institute fees, 2026-27 | [Academic Section circular](https://www.l1.nitk.ac.in/document/attachments/9831/Fees_Structure_removed.pdf) | 24 June 2026 | `f39169b1f9ae1b85a7bcb2a041a1177d681ae866d95ec86fce5718b2174d3c5d` |
| NITK Surathkal | Hostel and mess fees, 2026-27 | [Hostels Trust circular](https://www.l1.nitk.ac.in/document/attachments/9800/Fee_structure_2026-2027.pdf) | 15 June 2026 | `0b949226114084a178bc8a4b1968c372f402c5167bbe63241172021c28945fe1` |

The checksum is retained so a later ingestion run can detect a silent document
replacement rather than overwriting verified evidence.

## Reconciled totals

| Plan | Coverage | Gross | Confirmed remission | Net |
|---|---|---:|---:|---:|
| IIT Bombay UG, General/EWS/OBC-NCL | Autumn semester only | ₹1,76,600 | ₹0 | ₹1,76,600 |
| IIT Bombay UG, SC/ST/PwD | Autumn semester only | ₹76,600 | ₹0 | ₹76,600 |
| NITK B.Tech hosteller, income above ₹5 lakh | First academic year | ₹2,56,610 | ₹0 | ₹2,56,610 |
| NITK B.Tech hosteller, income below ₹1 lakh | First academic year | ₹2,56,610 | ₹1,25,000 | ₹1,31,610 |
| NITK B.Tech hosteller, income ₹1-5 lakh | First academic year | ₹2,56,610 | ₹83,333 | ₹1,73,277 |
| NITK B.Tech hosteller, SC/ST/PwD | First academic year | ₹2,56,610 | ₹1,25,000 | ₹1,31,610 |

These totals were previously reconciled in `server/data/verifiedFeePilot.test.js`;
that pilot dataset and its reconciliation test were removed as dead code, so the
figures above are now a record of the July 2026 review rather than an automated
check. Refundable deposits remain part of the initial cash requirement. Mess
amounts are advances, not a guarantee of final consumption cost.

## Deliberate limitations

- IIT Bombay data covers the Autumn semester for new entrants, not the entire
  academic year or programme.
- NITK data covers first-year 2026-27 only and is marked provisional by the
  institution.
- Travel, books, laptop and personal spending are excluded where the institution
  provides no authoritative student-specific amount.
- Seat-acceptance adjustments are excluded because they depend on a payment the
  individual applicant may already have made.
- Users must open the official notice again before making a payment because a
  university can revise a circular after this review date.

## API

Not implemented as of 2026-07-26. None of the three routes below exists in
`server/index.js`, and `src/pages/FeeExplorer.jsx` calls API helpers
(`getVerifiedFeePlan`, `getVerifiedFeePlans`) that do not exist in `src/api.js`,
so that page would throw at runtime. It is not routed in `src/App.jsx` and never
was, so nothing currently reaches it; it is kept only as reference work. Treat
this section as an interface proposal, not a description of behavior.

- `GET /api/fees/pilot` returns comparison summaries and source metadata.
- `GET /api/fees/pilot/:id` returns every component, aid item, source and limitation.
- `POST /api/fees/calculate` accepts a typed fee plan for deterministic scenario
  calculation; unsourced components are explicitly flagged as assumptions.
