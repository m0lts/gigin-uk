import { useState } from "react";
import '/styles/common/modals.styles.css'

export const AuthModal = ({ setAuthModal, login }) => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    login(credentials);
    setAuthModal(false);
  };

  const handleModalClick = (e) => {
    if (e.target.className=== 'modal') {
      setAuthModal(false);
    }
  };

  return (
    <div className="modal" onClick={handleModalClick}>
      <div className="modal-body" onClick={(e) => e.stopPropagation()}>
        <h2>Login</h2>
        <form onSubmit={handleSubmit}>
          <input type="text" name="username" value={credentials.username} onChange={handleChange} placeholder="Username" required />
          <input type="password" name="password" value={credentials.password} onChange={handleChange} placeholder="Password" required />
          <button type="submit">Login</button>
        </form>
        <button onClick={() => setAuthModal(false)}>Close</button>
      </div>
    </div>
  );
};