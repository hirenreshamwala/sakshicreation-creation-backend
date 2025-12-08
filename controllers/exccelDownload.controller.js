const ExcelJS = require('exceljs');
const { getAllAccountMasters } = require('./accountMaster.controller'); // Assuming the original function is in this file

exports.exportAccountMastersToExcel = async (req, res) => {
    try {
        // Create a mock request object with pagination disabled
        const mockReq = {
            body: {
                ...req.body,
                isPagination: false,
                includeCounts: false
            }
        };

        // Create a mock response object to capture the data
        let responseData;
        const mockRes = {
            status: () => ({
                json: (data) => {
                    responseData = data;
                }
            })
        };

        // Reuse the existing controller logic to get filtered data
        await getAllAccountMasters(mockReq, mockRes);

        if (!responseData || !responseData.success) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch account masters for export"
            });
        }

        // Create a new Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Account Masters');

        // Define columns
        worksheet.columns = [
            { header: 'Company', key: 'company', width: 20 },
            { header: 'Created Date', key: 'createdDate', width: 20 },
            { header: 'Party', key: 'party', width: 30 },
            { header: 'Contact Person', key: 'contactPerson', width: 20 },
            { header: 'Party Tag', key: 'partyTag', width: 15 },
            { header: 'Mobile No.', key: 'mobileNo', width: 15 },
            { header: 'Reason to Visit', key: 'reasonToVisit', width: 20 },
            { header: 'Unit No', key: 'unitNo', width: 15 },
            { header: 'Market', key: 'market', width: 20 },
            { header: 'Area', key: 'area', width: 15 },
            { header: 'Remarks', key: 'remarks', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Created By', key: 'createdBy', width: 20 },
            { header: 'Assign', key: 'assign', width: 20 }
        ];

        // Format and add data rows
        responseData.data.forEach(account => {
            worksheet.addRow({
                company: account.companyName?.name || '',
                createdDate: new Date(account.createdAt).toLocaleDateString(),
                party: account.party?.partyName || '',
                contactPerson: account.party?.contactPerson || '',
                partyTag: account.party?.partyTag || '',
                mobileNo: account.party?.ownerMobileNo || '',
                reasonToVisit: account.reasonToVisit || '',
                unitNo: account.party?.address?.unitNo || '',
                market: account.party?.address?.marketName?.marketName || '',
                area: account.party?.address?.area?.area || '',
                remarks: account.assignment?.remarks || '',
                status: account.party?.statusApproval || '',
                createdBy: `${account.createdBy?.firstName || ''} ${account.createdBy?.lastName || ''}`.trim(),
                assign: `${account.assignment?.assignedTo?.firstName || ''} ${account.assignment?.assignedTo?.lastName || ''}`.trim()
            });
        });

        // Style the header row
        worksheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD3D3D3' }
            };
        });

        // Set response headers for Excel download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=AccountMasters.xlsx');

        // Write the Excel file to the response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Error exporting account masters to Excel:", error);
        res.status(500).json({
            success: false,
            message: "Failed to export account masters to Excel",
            error: error.message,
        });
    }
};