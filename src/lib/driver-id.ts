import { prisma } from './prisma';

const DRIVER_ID_PATTERN = /^DRV-(\d+)$/;

/**
 * Next sequential driver id (DRV-001, DRV-002, …) per FuelGuard spec examples.
 */
export async function generateNextDriverId(): Promise<string> {
  if (!prisma) {
    throw new Error('Database is not configured.');
  }

  const drivers = await prisma.driver.findMany({
    where: {
      driverId: {
        startsWith: 'DRV-',
      },
    },
    select: { driverId: true },
  });

  let maxSequence = 0;
  for (const row of drivers) {
    const match = DRIVER_ID_PATTERN.exec(row.driverId);
    if (match) {
      maxSequence = Math.max(maxSequence, Number.parseInt(match[1], 10));
    }
  }

  const next = maxSequence + 1;
  return `DRV-${String(next).padStart(3, '0')}`;
}
