import jwt from 'jsonwebtoken';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { username, password } = req.body;

  // Verify username and password (this is just a placeholder, implement actual verification)
  if (username === 'user' && password === 'password') {
    const user = { username };
    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.setHeader('Set-Cookie', `jwt=${token}; HttpOnly; Secure; Path=/; Max-Age=3600`);
    return res.status(200).json({ user });
  }

  return res.status(401).json({ success: false });
}
