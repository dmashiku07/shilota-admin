var express = require("express");
var router = express.Router();
var {
  buildRecentAuditLogs,
  buildReportingOverview
} = require("../services/reportingService");

router.get("/overview", async function (_req, res) {
  try {
    return res.json({
      status: "true",
      data: await buildReportingOverview(new Date())
    });
  } catch (error) {
    console.error("Unable to load reporting overview:", error);
    return res.json({
      status: "false",
      message: "Unable to load reporting overview"
    });
  }
});

router.get("/audit-logs", async function (req, res) {
  try {
    return res.json({
      status: "true",
      data: await buildRecentAuditLogs(req.query.limit)
    });
  } catch (error) {
    console.error("Unable to load audit logs:", error);
    return res.json({
      status: "false",
      message: "Unable to load audit logs"
    });
  }
});

module.exports = router;
