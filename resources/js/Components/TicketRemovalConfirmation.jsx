import { Dialog } from '@headlessui/react';
import { useId } from 'react';
import Modal from '@/Components/Modal';

// Opening or cancelling this dialog never sends a removal request.
export default function TicketRemovalConfirmation({ show, itemName, kind, processing, errors = {}, onCancel, onConfirm }) {
    const titleId = useId();
    const cancel = () => { if (!processing) onCancel(); };
    return <Modal show={show} maxWidth="lg" closeable={!processing} onClose={cancel}>
        <section className="ticket-rating-dialog" aria-labelledby={titleId} aria-busy={processing}>
            <Dialog.Title as="h2" id={titleId}>Remove {kind}?</Dialog.Title>
            <h3>{itemName}</h3>
            <p>{kind === 'priority'
                ? 'If this priority has been used on a ticket, it will be archived and can be restored. Otherwise, it will be permanently deleted. Existing tickets and history will be preserved.'
                : 'This location will no longer be available for new tickets. Existing tickets and their location history will be preserved.'}</p>
            {Object.entries(errors).map(([key, message]) => <p className="ticket-error" role="alert" key={key}>{message}</p>)}
            <div className="ticket-rating-actions">
                <button type="button" autoFocus className="ticket-secondary" disabled={processing} onClick={cancel}>Cancel</button>
                <button type="button" className="ticket-primary" disabled={processing} onClick={onConfirm}>{processing ? 'Removing…' : 'Confirm removal'}</button>
            </div>
        </section>
    </Modal>;
}
