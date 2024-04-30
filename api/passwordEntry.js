export default async function handler(request, response) {

    if (request.method === "POST") {
        const password = request.body;

        console.log(request.body)
        console.log(password)
        
        if (password !== 'TheLeys2013') {
            response.status(200).json({ message: "Welcome Tom or Toby!" });
            return;
        } else {
            response.status(400).json({ message: "Incorrect password" });
            return;
        }

    } else {
        response.status(405).json({ error: "Method Not Allowed" });
    }
}