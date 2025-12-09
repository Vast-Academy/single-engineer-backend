// Offline sync scaffolding: placeholder endpoints to be implemented in later steps.

// Pull incremental changes since a given timestamp/watermark
const pullChanges = async (req, res) => {
    return res.status(501).json({
        success: false,
        message: 'Sync pull not implemented yet'
    });
};

// Push batched local changes from client to server
const pushChanges = async (req, res) => {
    return res.status(501).json({
        success: false,
        message: 'Sync push not implemented yet'
    });
};

module.exports = {
    pullChanges,
    pushChanges
};
