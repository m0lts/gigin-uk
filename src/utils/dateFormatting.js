export const formatSelectedDate = (dateStr) => {
    const date = new Date(dateStr);
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    const formattedDate = date.toLocaleDateString('en-US', options);
    return formattedDate.replace(/\b(\d{1,2})\b/g, (match, day) => {
        const lastDigit = day.slice(-1);
        switch (lastDigit) {
            case '1':
                return `${day}st`;
            case '2':
                return `${day}nd`;
            case '3':
                return `${day}rd`;
            default:
                return `${day}th`;
        }
    });
};