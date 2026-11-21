import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertSameCompany } from "./assertSameCompany.js";

describe("N-04: assertSameCompany helper", () => {
  const companyA = "660c1f2e9a3b4c5d6e7f8a90";
  const companyB = "660c1f2e9a3b4c5d6e7f8a91";

  it("thành công khi req.user.companyId trùng targetCompanyId (dạng string)", () => {
    const req = { user: { companyId: companyA } };
    assert.equal(assertSameCompany(req, companyA), true);
  });

  it("thành công khi req.companyId trùng targetCompanyId", () => {
    const req = { companyId: companyA };
    assert.equal(assertSameCompany(req, companyA), true);
  });

  it("thành công khi targetCompanyId là object có _id", () => {
    const req = { user: { companyId: companyA } };
    assert.equal(assertSameCompany(req, { _id: companyA }), true);
  });

  it("thành công khi req.user.companyId là object có _id (populate)", () => {
    const req = { user: { companyId: { _id: companyA, name: "Acme Corp" } } };
    assert.equal(assertSameCompany(req, companyA), true);
  });

  it("ném lỗi 403 khi khác công ty", () => {
    const req = { user: { companyId: companyA } };
    assert.throws(
      () => assertSameCompany(req, companyB),
      (err) => {
        assert.equal(err.status, 403);
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /Không có quyền truy cập dữ liệu của công ty khác/);
        return true;
      },
    );
  });

  it("ném lỗi 403 khi req không có companyId", () => {
    const req = { user: {} };
    assert.throws(
      () => assertSameCompany(req, companyA),
      (err) => {
        assert.equal(err.status, 403);
        return true;
      },
    );
  });

  it("ném lỗi 403 khi targetCompanyId null hoặc undefined", () => {
    const req = { user: { companyId: companyA } };
    assert.throws(
      () => assertSameCompany(req, null),
      (err) => {
        assert.equal(err.status, 403);
        return true;
      },
    );
  });
});
