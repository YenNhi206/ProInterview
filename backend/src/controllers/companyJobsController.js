/**
 * JB-01: Company Moderator quản lý tin tuyển dụng. Route đã qua `authJwt` + `requireCompanyModerator`,
 * nên `req.companyId` là công ty của người gọi; service lọc mọi truy vấn theo `companyId`.
 */
import * as jobPosts from "../services/jobPostsService.js";

export const CompanyJobsController = {
  async list(req, res) {
    const { jobs, pagination, counts } = await jobPosts.listCompanyJobs(req.companyId, req.query);
    res.json({ success: true, jobs, pagination, counts });
  },

  async get(req, res) {
    res.json({ success: true, job: await jobPosts.getCompanyJob(req.companyId, req.params.id) });
  },

  async create(req, res) {
    res.status(201).json({ success: true, job: await jobPosts.createCompanyJob(req.companyId, req.userId, req.body) });
  },

  async update(req, res) {
    res.json({ success: true, job: await jobPosts.updateCompanyJob(req.companyId, req.userId, req.params.id, req.body) });
  },

  async changeStatus(req, res) {
    res.json({ success: true, job: await jobPosts.changeCompanyJobStatus(req.companyId, req.userId, req.params.id, req.body) });
  },
};
