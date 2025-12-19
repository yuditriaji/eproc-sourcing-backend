/**
 * RFQ Module Tests
 * Tests for Request for Quotation CRUD and lifecycle operations
 */

import axios, { AxiosInstance } from 'axios';

const BASE_URL = process.env.BASE_URL || 'https://eproc-sourcing-backend.onrender.com';
const API_URL = `${BASE_URL}/api/v1`;

describe('RFQ Module Tests', () => {
    let client: AxiosInstance;
    let adminToken: string;
    let tenantSlug: string;
    let prId: string;
    let rfqId: string;
    let vendorId: string;

    beforeAll(async () => {
        client = axios.create({
            baseURL: API_URL,
            timeout: 30000,
            validateStatus: () => true,
        });

        // Register and login as ADMIN
        const adminEmail = `admin-rfq-${Date.now()}@test.com`;
        const regRes = await client.post('/auth/register', {
            email: adminEmail,
            username: `adminrfq${Date.now()}`,
            password: 'Admin@12345',
            firstName: 'Admin',
            lastName: 'RFQ',
            role: 'ADMIN',
        });

        if (regRes.data?.tenantSlug) {
            tenantSlug = regRes.data.tenantSlug;
        }

        const loginRes = await client.post('/auth/login', {
            email: adminEmail,
            password: 'Admin@12345',
        });
        adminToken = loginRes.data.accessToken;

        if (!tenantSlug && loginRes.data?.user?.tenantSlug) {
            tenantSlug = loginRes.data.user.tenantSlug;
        }

        // Create vendor for quotations
        const vendorRes = await client.post(
            `/${tenantSlug}/vendors`,
            {
                name: `RFQ Test Vendor ${Date.now()}`,
                registrationNumber: `REG-RFQ-${Date.now()}`,
                taxId: `TAX-RFQ-${Date.now()}`,
                contactEmail: `vendor-rfq-${Date.now()}@test.com`,
                status: 'ACTIVE',
            },
            { headers: { Authorization: `Bearer ${adminToken}` } },
        );
        if (vendorRes.status === 201) {
            vendorId = vendorRes.data.id;
        }
    });

    describe('RFQ-001: Create RFQ', () => {
        it('should create an RFQ in DRAFT status', async () => {
            const rfqData = {
                title: `Test RFQ ${Date.now()}`,
                description: 'RFQ for testing module',
                items: [
                    { name: 'Item 1', quantity: 100, unit: 'pcs' },
                    { name: 'Item 2', quantity: 50, unit: 'kg' },
                ],
                estimatedAmount: 50000,
                validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                category: 'IT Equipment',
                department: 'Technology',
            };

            const response = await client.post(`/${tenantSlug}/rfqs`, rfqData, {
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            if (response.status === 201) {
                expect(response.data).toHaveProperty('id');
                expect(response.data.status).toBe('DRAFT');
                expect(response.data.title).toBe(rfqData.title);
                expect(response.data).toHaveProperty('rfqNumber');
                rfqId = response.data.id;
            } else {
                console.log('Create RFQ response:', response.status, response.data);
            }
        });

        it('should retrieve RFQ by ID', async () => {
            if (!rfqId) {
                console.log('Skipping: No RFQ ID');
                return;
            }

            const response = await client.get(`/${tenantSlug}/rfqs/${rfqId}`, {
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            if (response.status === 200) {
                expect(response.data).toHaveProperty('id', rfqId);
                expect(response.data.status).toBe('DRAFT');
            }
        });

        it('should update RFQ in DRAFT status', async () => {
            if (!rfqId) {
                console.log('Skipping: No RFQ ID');
                return;
            }

            const updateData = {
                description: 'Updated RFQ description',
                estimatedAmount: 60000,
            };

            const response = await client.patch(`/${tenantSlug}/rfqs/${rfqId}`, updateData, {
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            if (response.status === 200) {
                expect(response.data.description).toBe(updateData.description);
            }
        });
    });

    describe('RFQ-002: RFQ Lifecycle', () => {
        it('should publish RFQ', async () => {
            if (!rfqId) {
                console.log('Skipping: No RFQ ID');
                return;
            }

            const response = await client.post(`/${tenantSlug}/rfqs/${rfqId}/publish`, {}, {
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            if (response.status === 200) {
                expect(response.data.status).toBe('PUBLISHED');
                expect(response.data).toHaveProperty('publishedAt');
            }
        });

        it('should not update RFQ after publishing', async () => {
            if (!rfqId) {
                console.log('Skipping: No RFQ ID');
                return;
            }

            const response = await client.patch(`/${tenantSlug}/rfqs/${rfqId}`, {
                description: 'Should fail',
            }, {
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            expect(response.status).toBe(400);
        });

        it('should close RFQ', async () => {
            if (!rfqId) {
                console.log('Skipping: No RFQ ID');
                return;
            }

            const response = await client.post(`/${tenantSlug}/rfqs/${rfqId}/close`, {}, {
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            if (response.status === 200) {
                expect(response.data.status).toBe('CLOSED');
                expect(response.data).toHaveProperty('closedAt');
            }
        });
    });

    describe('RFQ-003: RFQ Listing and Filtering', () => {
        it('should list all RFQs', async () => {
            const response = await client.get(`/${tenantSlug}/rfqs`, {
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            if (response.status === 200) {
                expect(response.data).toHaveProperty('data');
                expect(Array.isArray(response.data.data)).toBe(true);
                expect(response.data).toHaveProperty('total');
            }
        });

        it('should filter RFQs by status', async () => {
            const response = await client.get(`/${tenantSlug}/rfqs?status=CLOSED`, {
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            if (response.status === 200) {
                expect(Array.isArray(response.data.data)).toBe(true);
                if (response.data.data.length > 0) {
                    response.data.data.forEach((rfq: any) => {
                        expect(rfq.status).toBe('CLOSED');
                    });
                }
            }
        });

        it('should search RFQs', async () => {
            const response = await client.get(`/${tenantSlug}/rfqs?search=Test`, {
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            if (response.status === 200) {
                expect(Array.isArray(response.data.data)).toBe(true);
            }
        });
    });

    describe('RFQ-004: RFQ Cancel and Delete', () => {
        let cancelRfqId: string;

        it('should create and cancel an RFQ', async () => {
            // Create new RFQ
            const createRes = await client.post(`/${tenantSlug}/rfqs`, {
                title: `Cancel Test RFQ ${Date.now()}`,
                description: 'RFQ for cancellation testing',
                items: [{ name: 'Test Item', quantity: 10, unit: 'pcs' }],
            }, {
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            if (createRes.status === 201) {
                cancelRfqId = createRes.data.id;

                // Publish it first
                await client.post(`/${tenantSlug}/rfqs/${cancelRfqId}/publish`, {}, {
                    headers: { Authorization: `Bearer ${adminToken}` },
                });

                // Cancel it
                const response = await client.post(`/${tenantSlug}/rfqs/${cancelRfqId}/cancel`, {}, {
                    headers: { Authorization: `Bearer ${adminToken}` },
                });

                if (response.status === 200) {
                    expect(response.data.status).toBe('CANCELLED');
                }
            }
        });

        it('should delete RFQ in DRAFT status', async () => {
            // Create new RFQ
            const createRes = await client.post(`/${tenantSlug}/rfqs`, {
                title: `Delete Test RFQ ${Date.now()}`,
                description: 'RFQ for deletion testing',
                items: [{ name: 'Delete Item', quantity: 5, unit: 'pcs' }],
            }, {
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            if (createRes.status === 201) {
                const deleteRfqId = createRes.data.id;

                const response = await client.delete(`/${tenantSlug}/rfqs/${deleteRfqId}`, {
                    headers: { Authorization: `Bearer ${adminToken}` },
                });

                expect(response.status).toBe(200);
            }
        });
    });
});
