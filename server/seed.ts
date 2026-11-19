const markets = [
  { country: 'IN', currency: 'INR', baseSalary: 520_000, step: 10_500 },
  { country: 'US', currency: 'USD', baseSalary: 52_000, step: 1_050 },
  { country: 'GB', currency: 'GBP', baseSalary: 39_000, step: 820 },
  { country: 'DE', currency: 'EUR', baseSalary: 44_000, step: 920 },
  { country: 'CA', currency: 'CAD', baseSalary: 58_000, step: 1_150 },
  { country: 'FR', currency: 'EUR', baseSalary: 42_000, step: 900 },
];

const teams = [
  ['Engineering', 'Software Engineer'], ['Operations', 'Operations Specialist'],
  ['Product', 'Product Manager'], ['Finance', 'Financial Analyst'],
  ['People', 'People Partner'], ['Sales', 'Account Executive'],
  ['Support', 'Customer Success Specialist'], ['Design', 'Product Designer'],
];

const firstNames = ['Aarav', 'Amelia', 'Ananya', 'Camille', 'Daniel', 'Elena', 'Ishaan', 'Lena', 'Maya', 'Nina', 'Oliver', 'Priya', 'Samira', 'Sofia', 'Theo', 'Vivian'];
const surnames = ['Anderson', 'Banerjee', 'Chen', 'Cole', 'Dubois', 'Fischer', 'Gupta', 'Iyer', 'Kim', 'Martin', 'Mehta', 'Patel', 'Reed', 'Shah', 'Singh', 'Wilson', 'Wong'];

export function createEmployees(count = 10_000) {
  return Array.from({ length: count }, (_, index) => {
    const market = markets[index % markets.length];
    const [department, jobTitle] = teams[(Math.floor(index / markets.length) + index) % teams.length];
    const salaryBand = ((index * 37 + Math.floor(index / 97)) % 101);
    return {
      employee_code: `AC-${String(index + 1).padStart(5, '0')}`,
      display_name: `${firstNames[index % firstNames.length]} ${surnames[(index * 7 + Math.floor(index / firstNames.length)) % surnames.length]}`,
      job_title: jobTitle,
      department,
      country: market.country,
      currency: market.currency,
      salary_minor: (market.baseSalary + salaryBand * market.step) * 100,
    };
  });
}
