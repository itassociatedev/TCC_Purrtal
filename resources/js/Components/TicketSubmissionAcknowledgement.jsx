import { Dialog } from '@headlessui/react';
import { useId } from 'react';
import Modal from '@/Components/Modal';

// Receipt confirmation only: this does not acknowledge the ticket on behalf of IT or stop an SLA timer.
export default function TicketSubmissionAcknowledgement({ ticket, onClose, supportHours }) {
    // Format configured wall-clock hours directly, without browser timezone conversion.
    const formatHour = value => {
        const [hour, minute] = value.split(':').map(Number);
        return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
    };
    const titleId = useId();
    return <Modal show maxWidth="lg" onClose={onClose}>
        <section className="ticket-rating-dialog" aria-labelledby={titleId}>
            <button type="button" className="ticket-rating-close" onClick={onClose} aria-label="Close confirmation">×</button>
            <p className="ticket-rating-eyebrow">Ticket submitted successfully</p>
            <Dialog.Title as="h2" id={titleId}>Thank you for using our IT support service!</Dialog.Title>
            <h3>{ticket.subject}</h3>
            <p>Ticket #{ticket.code}</p>
            <p>Your ticket has been received. Our IT team will review and respond to your request during operating hours.</p>
            {supportHours?.opens && supportHours?.closes && <p><strong>IT operating hours: {formatHour(supportHours.opens)}–{formatHour(supportHours.closes)} daily.</strong></p>}
            <p>Tickets submitted outside operating hours will be reviewed when IT support resumes. You can find your ticket and track its progress on the “All my tickets” page.</p>
            <div className="ticket-rating-actions"><button type="button" className="ticket-primary" onClick={onClose}>Got it</button></div>
        </section>
    </Modal>;
}
