module.exports = function validateFields(requiredFields = []){
    return function (req, res, next){
        const missingFields = [];

        for (const field of requiredFields) {
        const value = req.body[field];

        if (typeof value === 'undefined' || value === null || value === '') {
            missingFields.push(field);
        }
        }

        if (missingFields.length > 0) {
        return res.status(400).json({
            msg: `Missing or empty fields: ${missingFields.join(', ')}`
        });
        }

        next();
    }
}