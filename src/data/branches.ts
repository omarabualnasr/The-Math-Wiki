export interface MathSubtopic {
  id: string;
  title: string;
  children?: MathSubtopic[];
}

export interface MathBranch {
  id: string;
  title: string;
  description: string;
  topics: MathSubtopic[];
}

const topic = (title: string): MathSubtopic => ({
  id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
  title,
});

export const mathBranches: MathBranch[] = [
  {
    id: 'foundations', title: 'Foundations of Mathematics', description: 'The logical language, structures and principles underlying mathematics.',
    topics: ['Mathematical Foundations', 'Mathematical Logic', 'Set Theory', 'Proof Theory', 'Model Theory', 'Computability Theory', 'Recursion Theory', 'Type Theory', 'Category Theory', 'Mathematical Structures', 'Axiomatic Mathematics', 'Foundations of Geometry'].map(topic),
  },
  {
    id: 'arithmetic', title: 'Arithmetic and Number Systems', description: 'Numbers, operations and the systems used to represent quantities.',
    topics: ['Arithmetic', 'Elementary Arithmetic', 'Natural Numbers', 'Whole Numbers', 'Integers', 'Rational Numbers', 'Irrational Numbers', 'Real Numbers', 'Complex Numbers', 'Quaternion Numbers', 'Number Systems', 'Modular Arithmetic', 'Elementary Number Theory'].map(topic),
  },
  {
    id: 'algebra', title: 'Algebra', description: 'Symbols, equations, operations and abstract mathematical structures.',
    topics: ['Algebra', 'Elementary Algebra', 'Intermediate Algebra', 'Abstract Algebra', 'Linear Algebra', 'Matrix Algebra', 'Boolean Algebra', 'Commutative Algebra', 'Noncommutative Algebra', 'Group Theory', 'Ring Theory', 'Field Theory', 'Lie Algebra', 'Universal Algebra', 'Homological Algebra', 'Representation Theory', 'Algebraic Structures', 'Algebraic Geometry'].map(topic),
  },
  {
    id: 'number-theory', title: 'Number Theory', description: 'The properties and relationships of integers and other number systems.',
    topics: ['Number Theory', 'Elementary Number Theory', 'Analytic Number Theory', 'Algebraic Number Theory', 'Geometric Number Theory', 'Computational Number Theory', 'Diophantine Equations', 'Prime Number Theory', 'Transcendental Number Theory', 'Additive Number Theory', 'Multiplicative Number Theory', 'p-adic Number Theory'].map(topic),
  },
  {
    id: 'geometry', title: 'Geometry', description: 'The study of shapes, space, dimensions, distances and transformations.',
    topics: ['Geometry', 'Euclidean Geometry', 'Non-Euclidean Geometry', 'Coordinate Geometry', 'Analytic Geometry', 'Differential Geometry', 'Algebraic Geometry', 'Projective Geometry', 'Affine Geometry', 'Synthetic Geometry', 'Convex Geometry', 'Discrete Geometry', 'Computational Geometry', 'Riemannian Geometry', 'Hyperbolic Geometry', 'Fractal Geometry', 'Solid Geometry', 'Plane Geometry'].map(topic),
  },
  {
    id: 'trigonometry', title: 'Trigonometry', description: 'Relationships between angles, lengths and trigonometric functions.',
    topics: ['Trigonometry', 'Basic Trigonometry', 'Unit Circle', 'Trigonometric Functions', 'Trigonometric Identities', 'Inverse Trigonometry', 'Spherical Trigonometry', 'Hyperbolic Trigonometry', 'Trigonometric Equations'].map(topic),
  },
  {
    id: 'calculus', title: 'Calculus', description: 'Change, accumulation, derivatives, integrals and their applications.',
    topics: ['Calculus', 'Differential Calculus', 'Integral Calculus', 'Single Variable Calculus', 'Multivariable Calculus', 'Vector Calculus', 'Advanced Calculus', 'Variational Calculus', 'Fractional Calculus', 'Calculus of Variations'].map(topic),
  },
  {
    id: 'analysis', title: 'Mathematical Analysis', description: 'Limits, continuity, convergence, functions, measures and operators.',
    topics: ['Mathematical Analysis', 'Real Analysis', 'Complex Analysis', 'Functional Analysis', 'Harmonic Analysis', 'Measure Theory', 'Integration Theory', 'Fourier Analysis', 'Distribution Theory', 'Asymptotic Analysis', 'Convex Analysis', 'Operator Theory', 'Nonstandard Analysis'].map(topic),
  },
  {
    id: 'topology', title: 'Topology', description: 'The mathematical study of continuity, connectedness and spatial properties.',
    topics: ['Topology', 'General Topology', 'Point-Set Topology', 'Algebraic Topology', 'Differential Topology', 'Geometric Topology', 'Knot Theory', 'Manifold Theory', 'Homotopy Theory', 'Homology Theory'].map(topic),
  },
  {
    id: 'discrete-mathematics', title: 'Discrete Mathematics', description: 'Countable structures, finite systems, arrangements and relationships.',
    topics: ['Discrete Mathematics', 'Combinatorics', 'Graph Theory', 'Enumerative Combinatorics', 'Extremal Combinatorics', 'Ramsey Theory', 'Design Theory', 'Coding Theory', 'Discrete Probability', 'Discrete Geometry', 'Discrete Structures', 'Combinatorial Optimization'].map(topic),
  },
  {
    id: 'probability-statistics', title: 'Probability and Statistics', description: 'Uncertainty, random phenomena, data analysis and statistical inference.',
    topics: ['Probability Theory', 'Statistics', 'Descriptive Statistics', 'Inferential Statistics', 'Bayesian Statistics', 'Frequentist Statistics', 'Mathematical Statistics', 'Multivariate Statistics', 'Nonparametric Statistics', 'Regression Analysis', 'Time Series Analysis', 'Experimental Design', 'Stochastic Processes', 'Stochastic Calculus', 'Statistical Modelling'].map(topic),
  },
  {
    id: 'differential-equations', title: 'Differential Equations', description: 'Equations describing relationships between functions and their derivatives.',
    topics: ['Differential Equations', 'Ordinary Differential Equations', 'Partial Differential Equations', 'Linear Differential Equations', 'Nonlinear Differential Equations', 'Systems of Differential Equations', 'Boundary Value Problems', 'Initial Value Problems', 'Integral Equations', 'Difference Equations'].map(topic),
  },
  {
    id: 'dynamical-systems', title: 'Dynamical Systems', description: 'Systems that evolve over time according to mathematical rules.',
    topics: ['Dynamical Systems', 'Linear Dynamical Systems', 'Nonlinear Dynamical Systems', 'Chaos Theory', 'Bifurcation Theory', 'Stability Theory', 'Ergodic Theory', 'Fractal Dynamics'].map(topic),
  },
  {
    id: 'optimization', title: 'Optimization and Operations Research', description: 'Methods for finding the best solution under defined constraints.',
    topics: ['Optimization', 'Linear Programming', 'Nonlinear Programming', 'Integer Programming', 'Convex Optimization', 'Discrete Optimization', 'Combinatorial Optimization', 'Multiobjective Optimization', 'Operations Research', 'Decision Theory', 'Scheduling Theory', 'Mathematical Planning'].map(topic),
  },
  {
    id: 'computational-mathematics', title: 'Numerical and Computational Mathematics', description: 'Algorithms and computational methods for mathematical problems.',
    topics: ['Numerical Analysis', 'Computational Mathematics', 'Scientific Computing', 'Numerical Linear Algebra', 'Numerical Optimization', 'Numerical Integration', 'Numerical Differential Equations', 'Computer Algebra', 'Symbolic Computation', 'Mathematical Algorithms', 'Monte Carlo Methods', 'Computational Number Theory', 'Computational Geometry'].map(topic),
  },
  {
    id: 'applied-mathematics', title: 'Mathematical Modelling and Applied Mathematics', description: 'Using mathematical ideas to understand and solve real-world problems.',
    topics: ['Applied Mathematics', 'Mathematical Modelling', 'Applied Analysis', 'Mathematical Simulation', 'Mathematical Engineering', 'Mathematical Biology', 'Mathematical Chemistry', 'Mathematical Medicine', 'Epidemiological Modelling', 'Mathematical Ecology', 'Mathematical Neuroscience', 'Mathematical Psychology', 'Mathematical Linguistics', 'Mathematical Sociology', 'Climate Modelling', 'Mathematical Geosciences'].map(topic),
  },
  {
    id: 'mathematical-physics', title: 'Mathematical Physics', description: 'Mathematical structures and methods used to describe physical systems.',
    topics: ['Mathematical Physics', 'Classical Mechanics', 'Quantum Mechanics', 'Relativity Mathematics', 'Fluid Mechanics', 'Continuum Mechanics', 'Statistical Mechanics', 'Electromagnetism Mathematics', 'Mathematical Quantum Theory', 'Quantum Information Theory'].map(topic),
  },
  {
    id: 'information-mathematics', title: 'Information and Communication Mathematics', description: 'The mathematics of information, encoding, communication and security.',
    topics: ['Information Theory', 'Coding Theory', 'Error-Correcting Codes', 'Cryptography', 'Combinatorial Designs', 'Network Theory', 'Communication Theory', 'Mathematical Cybersecurity', 'Computational Complexity'].map(topic),
  },
  {
    id: 'game-theory-economics', title: 'Game Theory and Economics', description: 'Mathematical approaches to strategy, markets, finance and risk.',
    topics: ['Game Theory', 'Combinatorial Game Theory', 'Cooperative Game Theory', 'Noncooperative Game Theory', 'Mathematical Economics', 'Econometrics', 'Mathematical Finance', 'Financial Mathematics', 'Actuarial Mathematics', 'Risk Theory'].map(topic),
  },
  {
    id: 'control-systems', title: 'Control and Systems Mathematics', description: 'Mathematical methods for modelling, controlling and understanding systems.',
    topics: ['Control Theory', 'Linear Control Systems', 'Nonlinear Control Systems', 'Optimal Control', 'Robust Control', 'System Identification', 'Signal Processing Mathematics', 'Systems Theory'].map(topic),
  },
  {
    id: 'data-science-ai', title: 'Data Science and Mathematical Learning', description: 'Mathematical foundations of data analysis, machine learning and AI.',
    topics: ['Mathematics of Data Science', 'Mathematical Machine Learning', 'Statistical Learning Theory', 'Mathematical Foundations of AI', 'Neural Network Mathematics', 'Optimization for Machine Learning', 'Probability in Machine Learning', 'Mathematics of Algorithms'].map(topic),
  },
];

export function slugify(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function findTopic(branchId: string, topicId: string): { branch: MathBranch; topic: MathSubtopic } | undefined {
  const branch = mathBranches.find((item) => item.id === branchId);
  const selected = branch?.topics.find((item) => item.id === topicId);
  if (!branch || !selected) return undefined;
  return { branch, topic: selected };
}

export const totalTopics = mathBranches.reduce((total, branch) => total + branch.topics.length + 1, 0);
