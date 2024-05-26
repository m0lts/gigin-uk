export default function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).end();
    }
  
    res.setHeader('Set-Cookie', 'jwt=; HttpOnly; Secure; Path=/; Max-Age=0');
    return res.status(200).json({ success: true });
  }
  