import React, { useRef } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { Session } from '@/types/models';
import { toDate, fmtBs, fmtDate } from '@/lib/utils/helpers';
import ES from '@/config/text.es';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  clientName: string;
  getStaffName: (id: string) => string;
  salonName?: string;
  clientPhone?: string;
}

export function ReceiptModal({ isOpen, onClose, session, clientName, getStaffName, salonName, clientPhone }: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!session) return null;

  const services = session.services || [];
  const retailItems = session.retailItems || [];
  const payments = (session.payments || []).filter((p) => p.status === 'completed');

  // Client receipt: services + retail items — materials are internal cost tracking, NOT shown to client
  const serviceTotal = services.reduce((sum, s) => sum + s.price, 0);
  const retailTotal = retailItems.reduce((sum, r) => sum + r.total, 0);
  const total = serviceTotal + retailTotal;
  const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  const methodLabels: Record<string, string> = {
    cash: ES.payments.cash,
    card: ES.payments.card,
    qr_code: ES.payments.qrCode,
    transfer: ES.payments.transfer,
    credit: ES.payments.creditBalance,
  };

  const handlePrint = () => {
    if (!receiptRef.current) return;
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${ES.receipt.title}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 320px; margin: 0 auto; padding: 16px; font-size: 13px; color: #111; line-height: 1.4; }
            .text-center { text-align: center; }
            .text-xs { font-size: 11px; }
            .text-sm { font-size: 12px; }
            .text-base { font-size: 14px; }
            .text-lg { font-size: 16px; }
            .font-bold { font-weight: 700; }
            .font-semibold { font-weight: 600; }
            .font-medium { font-weight: 500; }
            .text-gray-500 { color: #9ca3af; }
            .text-gray-500 { color: #6b7280; }
            .text-gray-600 { color: #4b5563; }
            .text-gray-700 { color: #374151; }
            .text-gray-900 { color: #111827; }
            .text-green-600 { color: #059669; }
            .mb-1 { margin-bottom: 4px; }
            .mb-2 { margin-bottom: 8px; }
            .mb-3 { margin-bottom: 12px; }
            .mt-1 { margin-top: 4px; }
            .my-2 { margin: 8px 0; }
            .my-3 { margin: 12px 0; }
            .ml-1 { margin-left: 4px; }
            .pt-2 { padding-top: 8px; }
            .space-y-1 > * + * { margin-top: 4px; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .border-t { border-top: 1px solid #e5e7eb; }
            .border-dashed { border-style: dashed; }
            .border-gray-300 { border-color: #d1d5db; }
            @media print { body { margin: 0; padding: 8px; } }
          </style>
        </head>
        <body>
          ${receiptRef.current.innerHTML}
          <script>window.print(); window.close();<\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const buildReceiptText = () => {
    const lines = [
      salonName || ES.app.name,
      `${ES.receipt.date}: ${fmtDate(session.date)}`,
      `${ES.sessions.client}: ${clientName}`,
      '',
      `--- ${ES.sessions.services} ---`,
      ...services.map((s) => `${s.serviceName}: ${fmtBs(s.price)}`),
      ...(retailItems.length > 0 ? [
        '',
        `--- ${ES.sessions.retailItems} ---`,
        ...retailItems.map((r) => `${r.productName} x${r.quantity}: ${fmtBs(r.total)}`),
      ] : []),
      '',
      `${ES.payments.total}: ${fmtBs(total)}`,
      ...(payments.length > 0 ? [
        '',
        `--- ${ES.receipt.paymentDetail} ---`,
        ...payments.map((p) => `${methodLabels[p.method] || p.method}: ${fmtBs(p.amount)}`),
        `${ES.payments.paid}: ${fmtBs(paidAmount)}`,
      ] : []),
      '',
      ES.receipt.thankYou,
    ];
    return lines.join('\n');
  };

  const handleShare = async () => {
    const text = buildReceiptText();
    if (navigator.share) {
      try {
        await navigator.share({ title: ES.receipt.title, text });
      } catch {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  const handleWhatsApp = () => {
    if (!clientPhone) return;
    const phone = clientPhone.replace(/\D/g, '');
    const text = encodeURIComponent(buildReceiptText());
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={ES.receipt.title}>
      <div ref={receiptRef}>
        <div className="text-center mb-3">
          <h2 className="text-lg font-bold">{salonName || ES.app.name}</h2>
          <p className="text-xs text-gray-500">{ES.receipt.date}: {fmtDate(session.date)}</p>
          <p className="text-xs text-gray-500">{ES.sessions.client}: {clientName}</p>
        </div>

        <div className="border-t border-dashed border-gray-300 my-2" />

        {/* Services */}
        <div className="space-y-1 mb-2">
          {services.map((svc) => (
            <div key={svc.id} className="flex justify-between text-sm">
              <span className="text-gray-700">
                {svc.serviceName}
                {svc.assignedStaff?.length > 0 && (
                  <span className="text-xs text-gray-500 ml-1">
                    ({svc.assignedStaff.map(getStaffName).join(', ')})
                  </span>
                )}
              </span>
              <span className="font-medium">{fmtBs(svc.price)}</span>
            </div>
          ))}
        </div>

        {/* Retail Items */}
        {retailItems.length > 0 && (
          <>
            <div className="border-t border-dashed border-gray-300 my-2" />
            <p className="text-xs text-gray-500 mb-1">{ES.sessions.retailItems}</p>
            <div className="space-y-1 mb-2">
              {retailItems.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">{item.productName} ×{item.quantity}</span>
                  <span className="font-medium">{fmtBs(item.total)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="border-t border-dashed border-gray-300 my-2" />

        {/* Total */}
        <div className="flex justify-between text-base font-bold">
          <span>{ES.payments.total}</span>
          <span>{fmtBs(total)}</span>
        </div>

        {/* Payment breakdown */}
        {payments.length > 0 && (
          <>
            <div className="border-t border-dashed border-gray-300 my-2" />
            <p className="text-xs text-gray-500 mb-1">{ES.receipt.paymentDetail}</p>
            {payments.map((p) => (
              <div key={p.id} className="flex justify-between text-sm">
                <span className="text-gray-600">{methodLabels[p.method] || p.method}</span>
                <span>{fmtBs(p.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold mt-1">
              <span>{ES.payments.paid}</span>
              <span className="text-green-600">{fmtBs(paidAmount)}</span>
            </div>
          </>
        )}

        <div className="border-t border-dashed border-gray-300 my-3" />
        <p className="text-center text-xs text-gray-500">{ES.receipt.thankYou}</p>
        {session.endTime && (
          <p className="text-center text-xs text-gray-500">
            {toDate(session.endTime).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200 flex-wrap">
        <Button size="sm" variant="primary" onClick={handlePrint}>
          {ES.receipt.print}
        </Button>
        <Button size="sm" variant="secondary" onClick={handleShare}>
          {ES.receipt.share}
        </Button>
        {clientPhone && (
          <Button size="sm" variant="secondary" onClick={handleWhatsApp}>
            {ES.receipt.shareWhatsApp}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onClose}>
          {ES.actions.close}
        </Button>
      </div>
    </Modal>
  );
}
