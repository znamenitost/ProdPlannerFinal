export default function EmployeeSelector({ value, onChange }) {
  const employees = ['Дима', 'Яромир', 'Павел'];
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {employees.map(emp => (
        <option key={emp} value={emp}>{emp}</option>
      ))}
    </select>
  );
}