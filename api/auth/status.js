import jwt from 'jsonwebtoken';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  const token = req.cookies.jwt;
  if (!token) {
    return res.status(200).json({ user: null });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    res.status(200).json({ user });
  } catch (error) {
    res.status(403).json({ user: null });
  }
}
