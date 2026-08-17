export const errorHandler = (err, req, res, _next) => {
    console.error("❌ Error:", err.message);
    const status = Number.isInteger(err.status) ? err.status : 500;
    res.status(status).json({ error: status >= 500 ? "Server Error" : err.message });
};
