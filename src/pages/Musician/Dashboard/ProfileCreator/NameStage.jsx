
export const NameStage = ({ data, onChange }) => {
    return (
        <div className="stage">
            <h2>Stage 1: Name</h2>
            <input
                type="text"
                value={data}
                onChange={(e) => onChange('name', e.target.value)}
                placeholder="Enter your name"
            />
        </div>
    );
};