import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import headerLogo from "@/assets/HEADERLOGO.png";
import { printDocument } from "@/lib/printDocument";
import { PRINT_LAYOUT } from "@/lib/printLayouts";

interface LossItem {
  propertyNumber: string;
  description: string;
  serialNumber?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  dateAcquired: string;
  dateOfLoss: string;
  cause: string;
  responsible: string;
  actionTaken: string;
}

interface LossReportProps {
  data: {
    // Header
    reportNumber: string; // RLSDDSP Number: 0000-00-0000
    reportDate: string;
    department: string;
    fundCluster?: string;
    icsNumber?: string;
    icsDate?: string;

    // Accountable Officer
    accountableOfficer: string;
    accountableOfficerDesignation?: string;

    // Property Status
    propertyStatus?: 'lost' | 'stolen' | 'damaged' | 'destroyed';

    // Police Notification
    policeNotified?: boolean;
    policeStation?: string;
    policeNotificationDate?: string;

    // Incident Details
    incidentDate?: string;
    incidentTime?: string;
    incidentPlace?: string;
    circumstances?: string;
    witnesses?: string;

    // Government ID
    governmentIdType?: string;
    governmentIdNumber?: string;
    idDateIssued?: string;

    // Signatures
    reportedBy: string;
    reportedByDate?: string;
    investigatedBy: string;
    supervisorName?: string;
    supervisorDate?: string;

    // Notarization (CRITICAL for legal compliance)
    notaryPublicName?: string;
    notaryDocNumber?: string;
    notaryPageNumber?: string;
    notaryBookNumber?: string;
    notarySeriesYear?: string;
    notaryDate?: string;

    // Items
    items: LossItem[];
    totalLoss: number;

    // Deadline tracking
    daysToReport?: number; // Should be ≤30
  };
}

export const LossReport: React.FC<LossReportProps> = ({ data }) => {
  const handlePrint = () => {
    void printDocument(PRINT_LAYOUT.A4_PORTRAIT);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-4 pr-12 print:hidden">
        <h2 className="text-2xl font-bold">Report of Lost, Stolen, Damaged or Destroyed Property</h2>
        <Button onClick={handlePrint} className="flex items-center gap-2">
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </div>

      <Card className="print-doc-a4-portrait max-w-none rounded-none print:shadow-none print:border-2 print:border-black" style={{ width: '1040px', margin: '0 auto' }}>
        <CardHeader className="text-center border-b-2 border-black p-0">
          <div className="w-full mb-2">
            <img src={headerLogo} alt="Official Header" className="w-full h-auto object-contain" />
          </div>
          <div className="pb-4 space-y-1">
            <div className="flex justify-end pr-4 text-xs italic">Annex A.9</div>
            <h1 className="text-lg font-bold uppercase">REPORT OF LOST, STOLEN, DAMAGED OR DESTROYED</h1>
            <h1 className="text-lg font-bold uppercase">SEMI-EXPENDABLE PROPERTY (RLSDDSP)</h1>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          {/* Header Information */}
          <div className="grid grid-cols-4 gap-4 text-xs border-2 border-gray-300 p-3 bg-gray-50">
            <div>
              <label className="font-semibold">RLSDDSP No.:</label>
              <p className="font-mono text-sm">{data.reportNumber}</p>
            </div>
            <div>
              <label className="font-semibold">Date:</label>
              <p>{data.reportDate}</p>
            </div>
            <div>
              <label className="font-semibold">ICS No.:</label>
              <p className="font-mono">{data.icsNumber || '_________'}</p>
            </div>
            <div>
              <label className="font-semibold">ICS Date:</label>
              <p>{data.icsDate || '_________'}</p>
            </div>
            <div className="col-span-2">
              <label className="font-semibold">Accountable Officer:</label>
              <p>{(data.department && !data.accountableOfficer.startsWith(data.department)) ? `${data.department}-${data.accountableOfficer}` : data.accountableOfficer}</p>
            </div>
            <div className="col-span-2">
              <label className="font-semibold">Designation:</label>
              <p>{data.accountableOfficerDesignation || '_________'}</p>
            </div>
          </div>

          {/* Property Status & Police Notification */}
          <div className="grid grid-cols-2 gap-4 border-2 border-gray-300 p-3">
            <div>
              <label className="text-xs font-semibold block mb-2">PROPERTY STATUS:</label>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={data.propertyStatus === 'lost'} readOnly />
                  <span>Lost</span>
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={data.propertyStatus === 'stolen'} readOnly />
                  <span>Stolen</span>
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={data.propertyStatus === 'damaged'} readOnly />
                  <span>Damaged</span>
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={data.propertyStatus === 'destroyed'} readOnly />
                  <span>Destroyed</span>
                </label>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-2">POLICE NOTIFIED:</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={data.policeNotified === true} readOnly />
                  <span>Yes</span>
                  <input type="checkbox" checked={data.policeNotified === false} readOnly className="ml-2" />
                  <span>No</span>
                </div>
                {data.policeNotified && (
                  <>
                    <div>
                      <label className="font-semibold">Station:</label>
                      <p>{data.policeStation}</p>
                    </div>
                    <div className="col-span-2">
                      <label className="font-semibold">Date Notified:</label>
                      <p>{data.policeNotificationDate}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Incident Details */}
          {data.circumstances && (
            <div className="border-2 border-gray-300 p-3">
              <label className="text-xs font-semibold block mb-2">CIRCUMSTANCES OF INCIDENT:</label>
              <div className="grid grid-cols-3 gap-3 text-xs mb-2">
                <div>
                  <span className="font-semibold">Date:</span> {data.incidentDate || '_________'}
                </div>
                <div>
                  <span className="font-semibold">Time:</span> {data.incidentTime || '_________'}
                </div>
                <div>
                  <span className="font-semibold">Place:</span> {data.incidentPlace || '_________'}
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap border border-gray-300 p-2 bg-white">{data.circumstances}</p>
              {data.witnesses && (
                <div className="mt-2">
                  <span className="font-semibold text-xs">Witnesses:</span>
                  <p className="text-sm">{data.witnesses}</p>
                </div>
              )}
              {data.daysToReport !== undefined && (
                <div className="mt-2 text-xs">
                  <span className={`font-semibold ${data.daysToReport > 30 ? 'text-red-600' : 'text-green-600'}`}>
                    Reported {data.daysToReport} days after incident
                    {data.daysToReport > 30 && ' ⚠️ EXCEEDS 30-DAY REQUIREMENT'}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="border-2 border-black">
            <table className="text-xs border-collapse" style={{ width: '988px', tableLayout: 'fixed' }}>
              <thead>
                <tr className="border-b-2 border-black bg-gray-100">
                  <th className="border-r border-black p-2 text-center" style={{ width: '50px' }}>Item No.</th>
                  <th className="border-r border-black p-2 text-center" style={{ width: '120px' }}>Property Number</th>
                  <th className="border-r border-black p-2 text-center" style={{ width: '250px' }}>Description</th>
                  <th className="border-r border-black p-2 text-center" style={{ width: '50px' }}>Qty</th>
                  <th className="border-r border-black p-2 text-center" style={{ width: '90px' }}>Unit Cost</th>
                  <th className="border-r border-black p-2 text-center" style={{ width: '110px' }}>Total Cost</th>
                  <th className="border-r border-black p-2 text-center" style={{ width: '90px' }}>Date Acquired</th>
                  <th className="border-r border-black p-2 text-center" style={{ width: '90px' }}>Date of Loss</th>
                  <th className="border-r border-black p-2 text-center" style={{ width: '130px' }}>Cause</th>
                  <th className="border-r border-black p-2 text-center" style={{ width: '130px' }}>Responsible Person</th>
                  <th className="p-2 text-center" style={{ width: '138px' }}>Action Taken</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-300">
                    <td className="border-r border-black p-2 text-center">{index + 1}</td>
                    <td className="border-r border-black p-2 text-center font-mono">{item.propertyNumber}</td>
                    <td className="border-r border-black p-2">
                      {item.description}
                      {item.serialNumber && <div className="text-[9px] text-gray-600 mt-0.5">SN: {item.serialNumber}</div>}
                    </td>
                    <td className="border-r border-black p-2 text-center">{item.quantity}</td>
                    <td className="border-r border-black p-2 text-right">₱{item.unitCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td className="border-r border-black p-2 text-right font-semibold">₱{item.totalCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td className="border-r border-black p-2 text-center">{item.dateAcquired}</td>
                    <td className="border-r border-black p-2 text-center">{item.dateOfLoss}</td>
                    <td className="border-r border-black p-2">{item.cause}</td>
                    <td className="border-r border-black p-2">{item.responsible}</td>
                    <td className="p-2">{item.actionTaken}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black bg-gray-100">
                  <td colSpan={5} className="border-r border-black p-2 text-center font-semibold">TOTAL LOSS VALUE:</td>
                  <td className="border-r border-black p-2 text-right font-bold text-lg text-red-600">
                    ₱{data.totalLoss.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={5} className="p-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notarization Section (CRITICAL for Annex A.9) */}
          <div className="mt-6 border-t-2 border-black pt-4">
            <div className="grid grid-cols-2 gap-8">
              {/* Left Side: Signatures */}
              <div className="space-y-6">
                <div className="text-center">
                  <p className="text-xs font-semibold mb-4">I HEREBY CERTIFY that the foregoing is a true and correct statement of:</p>
                  <div className="flex gap-4 justification-center text-xs font-bold">
                    <span className="border-b border-black px-2">{data.circumstances || '________________'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center pt-8">
                    <div className="border-b border-black mb-1">
                      <p className="font-bold text-sm uppercase">{data.reportedBy}</p>
                    </div>
                    <p className="text-xs">Signature over Printed Name of Accountable Officer</p>
                    <p className="text-xs mt-1">{data.reportedByDate || 'Date'}</p>
                  </div>

                  <div className="text-center pt-8">
                    <div className="border-b border-black mb-1">
                      <p className="font-bold text-sm uppercase">{data.investigatedBy}</p>
                    </div>
                    <p className="text-xs">Signature over Printed Name of Investigator</p>
                    <p className="text-xs mt-1">Date</p>
                  </div>
                </div>

                <div className="text-center pt-8">
                  <p className="text-xs mb-4">ATTESTED BY:</p>
                  <div className="w-2/3 mx-auto">
                    <div className="border-b border-black mb-1">
                      <p className="font-bold text-sm uppercase">{data.supervisorName || '_____________________'}</p>
                    </div>
                    <p className="text-xs">Immediate Supervisor</p>
                    <p className="text-xs mt-1">{data.supervisorDate || 'Date'}</p>
                  </div>
                </div>
              </div>

              {/* Right Side: Notarization */}
              <div className="border-l-2 border-black pl-8 space-y-4">
                <p className="text-xs font-bold text-center uppercase mb-4">SUBSCRIBED AND SWORN to before me this ______ day of ____________, 20____, affiant exhibiting the following identification:</p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="font-semibold">Gov't Issued ID:</span>
                    <div className="border-b border-black h-5">{data.governmentIdType}</div>
                  </div>
                  <div>
                    <span className="font-semibold">ID No.:</span>
                    <div className="border-b border-black h-5">{data.governmentIdNumber}</div>
                  </div>
                  <div className="col-span-2">
                    <span className="font-semibold">Date Issued:</span>
                    <div className="border-b border-black h-5">{data.idDateIssued}</div>
                  </div>
                </div>

                <div className="pt-12 text-center">
                  <div className="border-b border-black mb-1 w-3/4 mx-auto">
                    <p className="font-bold text-sm uppercase">{data.notaryPublicName || '_____________________'}</p>
                  </div>
                  <p className="text-xs font-bold">Notary Public</p>
                  <p className="text-[10px]">Until December 31, 20____</p>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs mt-4">
                  <span>Doc. No.</span>
                  <span className="border-b border-black">{data.notaryDocNumber || '______'}</span>

                  <span>Page No.</span>
                  <span className="border-b border-black">{data.notaryPageNumber || '______'}</span>

                  <span>Book No.</span>
                  <span className="border-b border-black">{data.notaryBookNumber || '______'}</span>

                  <span>Series of</span>
                  <span className="border-b border-black">{data.notarySeriesYear || '______'}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
};