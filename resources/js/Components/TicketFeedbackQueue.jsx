import { useRef, useState } from 'react';
import { router, useForm } from '@inertiajs/react';
import { Dialog } from '@headlessui/react';
import Modal from '@/Components/Modal';

export function TicketRatingDialog({ ticket, remaining, ticketRoute, onDone, onSkip }) {
    const form = useForm({ action: 'feedback', rating: 0, note: '' });
    const [hover, setHover] = useState(0);
    const close = () => { form.cancel(); onSkip(ticket.id); };
    return <Modal show maxWidth="lg" onClose={close}>
        <section className="ticket-rating-dialog" aria-labelledby="ticket-rating-title">
            <button type="button" className="ticket-rating-close" onClick={close} aria-label="Skip rating">×</button>
            <p className="ticket-rating-eyebrow">Ticket closed · Optional feedback</p>
            <Dialog.Title as="h2" id="ticket-rating-title">How was our service?</Dialog.Title><h3>{ticket.subject}</h3>
            <p>Your rating is for the IT staff member who resolved this ticket.</p>
            <form onSubmit={e => { e.preventDefault(); if (!form.data.rating) return; form.transform(data => ({ ...data, note: data.rating <= 3 ? data.note : '' })); form.patch(ticketRoute('update', { ticket: ticket.id }), { preserveScroll: true, onSuccess: () => onDone(ticket.id) }); }}>
                {/* Ten native radio targets provide half-star steps with keyboard support. */}
                <fieldset className="ticket-rating-stars" onMouseLeave={() => setHover(0)}><legend className="sr-only">Choose a rating from half a star to five stars, in half-star steps</legend>
                    {[1, 2, 3, 4, 5].map(n => {
                        const fill = Math.max(0, Math.min(1, (hover || form.data.rating) - n + 1));
                        return <span className="ticket-rating-star" key={n}>
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2Z" /></svg>
                            {fill > 0 && <svg viewBox="0 0 24 24" aria-hidden="true" className={fill === 1 ? 'filled' : 'half-filled'} style={{ clipPath: `inset(0 ${100 - fill * 100}% 0 0)` }}><path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2Z" /></svg>}
                            {[n - 0.5, n].map((value, half) => <label key={value} className={`ticket-rating-hit ticket-rating-hit-${half}`} onMouseEnter={() => setHover(value)}>
                                <input type="radio" name={`ticket-rating-${ticket.id}`} value={value} checked={form.data.rating === value} onChange={() => form.setData('rating', value)} aria-label={`${value} star${value === 1 ? '' : 's'}`} /><span className="sr-only">{value} stars</span>
                            </label>)}
                        </span>;
                    })}
                </fieldset>
                <p className="ticket-rating-selection" aria-live="polite">{form.data.rating ? `${form.data.rating} of 5 stars` : 'Select a star to rate'}</p>
                {form.data.rating > 0 && form.data.rating <= 3 && <label className="ticket-rating-comment">What could we improve? (optional)<textarea rows={3} maxLength={10000} value={form.data.note} onChange={e => form.setData('note', e.target.value)} /></label>}
                {Object.entries(form.errors).map(([key, message]) => <p className="ticket-error" role="alert" key={key}>{message}</p>)}
                <div className="ticket-rating-actions"><button type="button" className="ticket-secondary" onClick={close}>Skip</button><button className="ticket-primary" disabled={!form.data.rating || form.processing}>{form.processing ? 'Submitting…' : 'Submit rating'}</button></div>
            </form>
            {remaining > 1 && <p className="ticket-rating-count">{remaining} closed tickets awaiting optional feedback</p>}
        </section>
    </Modal>;
}

export default function TicketFeedbackQueue({ tickets, ticketRoute }) {
    const [done, setDone] = useState([]);
    const skipped = useRef(new Set());
    const queue = tickets.filter(ticket => !done.includes(ticket.id));
    const current = queue[0];
    const complete = id => setDone(ids => [...ids, id]);
    const skip = id => {
        // Advance immediately; dismissal persists on the server without a fabricated rating.
        complete(id);
        if (skipped.current.has(id)) return;
        skipped.current.add(id);
        router.patch(ticketRoute('update', { ticket: id }), { action: 'dismiss_feedback' }, { preserveState: true, preserveScroll: true });
    };
    return current ? <TicketRatingDialog key={current.id} ticket={current} remaining={queue.length} ticketRoute={ticketRoute} onDone={complete} onSkip={skip} /> : null;
}
