import { InsertImageIcon, XIcon } from "/components/Icons/Icons"
import './equipment.inputs.styles.css'

export const EquipmentImageInput = ({ equipment, image, setImage }) => {
    const handleImageChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImage(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeImage = () => {
        setImage(null);
        const input = document.getElementById(`image-input-${equipment}`);
        if (input) {
            input.value = '';
        }
    };

    return (
        <div className="equipment" key={equipment}>
            <h3 className="subtitle">{equipment}:</h3>
            <div className="single-image-input-cont">
                <label htmlFor={`image-input-${equipment}`} className="insert-image-label">
                    {image ? (
                        <>
                            <img src={image} alt='Preview' className="preview-image" />
                            <div className="remove-image" onClick={removeImage}>
                                <XIcon />
                                <span>Remove Image</span>
                            </div>
                        </>
                    ) : (
                        <> 
                            <InsertImageIcon />
                            <span>Insert Image</span>
                        </>
                    )}
                </label>
                <input
                    type="file"
                    id={`image-input-${equipment}`}
                    accept="image/*"
                    className="image-input"
                    onChange={(event) => handleImageChange(event)}
                />
            </div>
        </div>
    );
};
