// Portal.jsx
import { createPortal } from "react-dom";

export default function Portal({ children }) {
  const root = document.body;
  return createPortal(children, root);
}