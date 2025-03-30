// Contents of the new js/collision.js

// Note: This function now takes the 'units' array as an argument.

export function handleCollisions(units) { // Pass units array
    for (let i = 0; i < units.length; i++) {
        for (let j = i + 1; j < units.length; j++) {
            const unitA = units[i];
            const unitB = units[j];

            // Skip collision check if either unit is dead OR broken (routing units ignore collision)
            if (unitA.isDead || unitB.isDead || unitA.isBroken || unitB.isBroken) continue;

            const dx = unitB.x - unitA.x;
            const dy = unitB.y - unitA.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = unitA.radius + unitB.radius;

            if (distance < minDistance && distance > 0) { // Added distance > 0 check
                // Collision detected - simple separation
                const overlap = minDistance - distance;
                // Avoid division by zero if distance is exactly 0 (units perfectly overlap)
                const separationX = (dx / distance) * (overlap / 2);
                const separationY = (dy / distance) * (overlap / 2);


                // Apply separation based on mass (lighter units move more)
                const totalMass = unitA.mass + unitB.mass;
                // Prevent division by zero if totalMass is 0 (though unlikely with current setup)
                const moveFactorA = totalMass > 0 ? unitB.mass / totalMass : 0.5;
                const moveFactorB = totalMass > 0 ? unitA.mass / totalMass : 0.5;


                // Only apply separation if units aren't broken
                 if (!unitA.isBroken) {
                    unitA.x -= separationX * moveFactorA;
                    unitA.y -= separationY * moveFactorA;
                 }
                 if (!unitB.isBroken) {
                    unitB.x += separationX * moveFactorB;
                    unitB.y += separationY * moveFactorB;
                 }

                // Optional: Slightly adjust target if units collide while moving to prevent sticking
                // if (unitA.isMoving) unitA.targetX -= separationX * moveFactorA * 0.1;
                // if (unitA.isMoving) unitA.targetY -= separationY * moveFactorA * 0.1;
                // if (unitB.isMoving) unitB.targetX += separationX * moveFactorB * 0.1;
                // if (unitB.isMoving) unitB.targetY += separationY * moveFactorB * 0.1;

            }
        }
    }
}
