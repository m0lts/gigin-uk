# Gigin Codebase Refactor (June 2025)

This document tracks the structure, naming, and optimisation changes being made in the `optimisation/refactor-june-2025` branch.

## 📌 Phase 1: Folder & File Restructure

### 🔁 Core Moves

- [ ] Move `src/firebase.js` → `src/lib/firebase.js` ✅
- [ ] Move `src/components/ui/` → `src/features/shared/ui/` ✅
- [ ] Move `src/components/forms/` → `src/features/shared/forms/` ✅
- [ ] Move `src/components/common/` → `src/features/shared/components/` ✅
- [ ] Move `src/components/musician-components/` → `src/features/musician/components/` ✅
- [ ] Move `src/components/venue-components/` → `src/features/venue/components/` ✅
- [ ] Move `src/pages/Musician/` → `src/features/musician/` ✅
- [ ] Move `src/pages/Venue/` → `src/features/venue/` ✅
- [ ] Move `src/pages/Messages/` → `src/features/messages/` ✅
- [ ] Move `src/pages/AccountPage/` → `src/features/account/` ✅
- [ ] Remove or archive `/pages/` if fully migrated ✅

---

## 🧱 Phase 2: Naming, Comments & Style Conventions

- [ ] Ensure all React components use `PascalCase.jsx` ✅
- [ ] Rename custom hooks to `useCamelCase.js` ✅
- [ ] Place all Firestore calls into `src/services/` with clear function names ✅
- [ ] Move commonly used util functions (e.g. formatDate) to /services/utils ✅

---

## 🚀 Phase 3: Optimisation Pass (after refactor complete)

- [ ] Audit Firebase reads: eliminate unnecessary full collection reads
- [ ] Batch Firestore writes where possible
- [ ] Move expensive logic out of components into services
- [ ] Review Firestore indexes and rules for efficiency
- [ ] Use `React.memo` or `useMemo` where render-heavy components exist

---

## 🧪 Dev Checklist While Restructuring

- [ ] `npm run dev` works after each structural change
- [ ] Routing continues to work (especially for moved pages)
- [ ] Test musician + venue flows manually after moving major folders