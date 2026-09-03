import Input from '../../../shared/components/ui/Input';

/** Optional. It only exists to make the AI advice sound like it knows you. */
export default function PlaceStep({ form, onChange }) {
  return (
    <>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Optional, but it makes the AI advice sound less like a robot and more like a senior from your hostel.
      </p>

      <Input
        label="University or college"
        placeholder="e.g. University of the Punjab"
        value={form.university}
        onChange={(event) => onChange({ university: event.target.value })}
      />

      <Input
        label="Hostel name"
        placeholder="e.g. Hostel Block C"
        value={form.hostelName}
        onChange={(event) => onChange({ hostelName: event.target.value })}
      />
    </>
  );
}
