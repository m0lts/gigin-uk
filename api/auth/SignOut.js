export default function handler(req, res) {
    if (req.method === 'POST') {
        // Clear the JWT token cookie
        res.setHeader('Set-Cookie', 'token=; HttpOnly; Secure; Path=/; Max-Age=0; SameSite=Strict; expires=Thu, 01 Jan 1970 00:00:00 GMT');
        res.status(200).json({ message: 'Logged out successfully' });
    } else {
        // Only allow POST requests
        res.status(405).json({ message: 'Method Not Allowed' });
    }
}