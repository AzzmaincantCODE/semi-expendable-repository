import React from 'react';
import { AnnexRRSPPrintData } from '@/types/annex';
import { format } from 'date-fns';
import headerLogo from '@/assets/HEADERLOGO.png';

interface ReturnReceiptReportProps {
  data: AnnexRRSPPrintData;
}

export const ReturnReceiptReport: React.FC<ReturnReceiptReportProps> = ({ data }) => {
  const rowCount = Math.max(8, data.items.length);

  return (
    <div className="bg-white p-8 w-full max-w-4xl mx-auto text-black font-serif text-sm print:p-4 print:max-w-none">
      <div className="mb-3 flex w-full justify-center overflow-hidden">
        <img
          src={headerLogo}
          alt="Province of Apayao - General Services Office"
          className="mx-auto block h-auto w-full object-contain object-bottom [object-position:center_bottom]"
        />
      </div>
      <div className="text-right italic mb-1 font-bold">Annex A.6</div>

      <div className="text-center font-bold text-lg mb-2 uppercase tracking-wide">
        Receipt of Returned Semi-Expendable Property
      </div>

      <table className="w-full table-fixed border-collapse border border-black mb-6">
        <tbody>
          <tr>
            <td colSpan={3} className="border border-black px-2 py-0 align-middle">
              <span className="font-bold mr-2">Entity Name:</span>
              <span className="font-bold uppercase">{data.entityName}</span>
            </td>
            <td colSpan={2} className="border border-black p-0 align-middle">
              <div className="flex items-center border-b border-black px-2 py-0">
                <span className="font-bold whitespace-nowrap mr-2 shrink-0">Date:</span>
                <span>{data.date ? format(new Date(data.date), 'MMMM d, yyyy') : ''}</span>
              </div>
              <div className="flex items-center px-2 py-0">
                <span className="font-bold whitespace-nowrap mr-2 shrink-0">RRSP No.:</span>
                <span className="font-mono font-bold">{data.rrspNumber?.replace(/^RRSP-/, '')}</span>
              </div>
            </td>
          </tr>
          <tr>
            <td
              colSpan={5}
              className="border border-black px-2 py-2 text-center italic bg-gray-50/80"
            >
              This is to acknowledge receipt of the returned Semi-expendable Property
            </td>
          </tr>
          <tr className="bg-gray-100">
            <th className="border border-black p-2 text-center w-[40%]">Item Description</th>
            <th className="border border-black p-2 text-center w-[10%]">Quantity</th>
            <th className="border border-black p-2 text-center w-[15%]">ICS No.</th>
            <th className="border border-black p-2 text-center w-[15%]">End-user</th>
            <th className="border border-black p-2 text-center w-[20%]">Remarks</th>
          </tr>
          {Array.from({ length: rowCount }).map((_, i) => {
            const item = i < data.items.length ? data.items[i] : null;
            return (
              <tr key={i}>
                <td className="border border-black p-2 align-top min-h-[2rem]">
                  {item?.itemDescription || '\u00A0'}
                </td>
                <td className="border border-black p-2 text-center align-middle">
                  {item?.quantity ?? '\u00A0'}
                </td>
                <td className="border border-black p-2 text-center align-middle">
                  {item?.icsNumber || '\u00A0'}
                </td>
                <td className="border border-black p-2 text-center align-middle">
                  {item?.endUser || '\u00A0'}
                </td>
                <td className="border border-black p-2 align-top">
                  {item?.remarks || '\u00A0'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

    <div className="grid grid-cols-2 gap-8 px-1">
      <div>
        <div className="font-bold mb-8">Returned by:</div>
        <div className="text-center">
          <div className="border-b-2 border-black font-bold h-6 mb-1">{data.returnedBy}</div>
          <div className="text-xs uppercase">{data.returnedByDesignation || 'End User'}</div>
          <div className="mt-4 border-b border-black w-3/4 mx-auto h-6 flex items-end justify-center font-bold text-xs">
            {data.date ? format(new Date(data.date), 'MMMM d, yyyy') : ''}
          </div>
          <div className="text-xs">Date</div>
        </div>
      </div>
      <div>
        <div className="font-bold mb-8">Received by:</div>
        <div className="text-center">
          <div className="border-b-2 border-black font-bold h-6 mb-1">{data.receivedBy}</div>
          <div className="text-xs font-semibold uppercase">
            {data.receivedByDesignation || 'Head, Property and/or Supply Division/Unit'}
          </div>
          <div className="mt-4 border-b border-black w-3/4 mx-auto h-6 flex items-end justify-center font-bold text-xs">
            {data.date ? format(new Date(data.date), 'MMMM d, yyyy') : ''}
          </div>
          <div className="text-xs">Date</div>
        </div>
      </div>
    </div>
    </div>
  );
};
