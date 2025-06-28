const mapboxToken = process.env.MAPBOX_API_KEY;

export default function handler(req, res) {
  try {
    res.status(200).json({ mapboxToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

