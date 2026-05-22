import { randomSalt, hashAnswer } from "./crypto.js";

/**
 * Karışık bulmaca: zor matematik (yazılı), matematik çoktan seçmeli, ipuçlu çoktan seçmeli.
 * Doğru cevap her zaman not (N) ile aynıdır.
 */
export async function generatePuzzle(grade) {
  const n = Math.round(Number(grade));
  if (Number.isNaN(n) || n < 0 || n > 100) {
    throw new Error("Not 0 ile 100 arasında olmalıdır.");
  }

  const roll = Math.random();
  const salt = randomSalt();
  const answerHash = await hashAnswer(n, salt);

  let puzzle;
  if (roll < 0.3) {
    puzzle = { ...generateHardMathPuzzle(n), type: "math" };
  } else if (roll < 0.7) {
    puzzle = { ...generateMathMcqPuzzle(n), type: "mcq", subType: "math_mcq" };
  } else {
    puzzle = { ...generateHintMcqPuzzle(n), type: "mcq", subType: "hint_mcq" };
  }

  return { ...puzzle, salt, answerHash };
}

function generateHardMathPuzzle(n) {
  const hard = [];

  for (let a = 2; a <= 15; a++) {
    for (let b = 2; b <= 12; b++) {
      const product = a * b;
      const plus = n - product;
      if (plus > 0 && plus <= 40) {
        hard.push({ question: `(${a} × ${b}) + ${plus} = ?`, answer: n });
      }
      const minus = product - n;
      if (minus > 0 && minus < product) {
        hard.push({ question: `(${a} × ${b}) − ${minus} = ?`, answer: n });
      }
    }
  }

  for (let a = 1; a <= 12; a++) {
    for (let b = 1; b <= 12; b++) {
      for (let c = 2; c <= 9; c++) {
        const inner = (a + b) * c;
        const minus = inner - n;
        if (minus > 0 && minus < inner) {
          hard.push({ question: `(${a} + ${b}) × ${c} − ${minus} = ?`, answer: n });
        }
        const plus = n - inner;
        if (plus > 0 && plus <= 35) {
          hard.push({ question: `(${a} + ${b}) × ${c} + ${plus} = ?`, answer: n });
        }
      }
    }
  }

  for (let a = 2; a <= 12; a++) {
    if (n % a === 0) {
      const sum = n / a;
      for (let b = 1; b < sum; b++) {
        const c = sum - b;
        if (c > 0 && c <= 25) {
          hard.push({ question: `${a} × (${b} + ${c}) = ?`, answer: n });
        }
      }
    }
  }

  for (let a = 2; a <= 10; a++) {
    for (let b = 2; b <= 10; b++) {
      for (let c = 1; c <= 15; c++) {
        const val = a * b + c;
        if (val === n) {
          hard.push({ question: `${a} × ${b} + ${c} = ?`, answer: n });
        }
        const val2 = a * b - c;
        if (val2 === n && c < a * b) {
          hard.push({ question: `${a} × ${b} − ${c} = ?`, answer: n });
        }
      }
    }
  }

  if (hard.length === 0) {
    return generateMediumMathPuzzle(n);
  }

  return hard[Math.floor(Math.random() * hard.length)];
}

function generateMediumMathPuzzle(n) {
  const medium = [];

  for (let a = 2; a <= 12; a++) {
    if (n % a === 0 && n / a >= 2 && n / a <= 50) {
      medium.push({ question: `${a} × ${n / a} = ?`, answer: n });
    }
  }

  for (let b = 2; b <= 12; b++) {
    const product = n * b;
    if (product <= 200) {
      medium.push({ question: `${product} ÷ ${b} = ?`, answer: n });
    }
  }

  if (medium.length === 0) {
    const a = Math.max(1, Math.floor(n / 2));
    const b = n - a;
    return { question: `${a} + ${b} = ?`, answer: n };
  }

  return medium[Math.floor(Math.random() * medium.length)];
}

function generateMathMcqPuzzle(n) {
  const template = generateHardMathPuzzle(n);
  const choices = pickNumericChoices(n, 4);

  return {
    question: `${template.question} — Sonuç hangisi?`,
    choices,
    answer: n,
  };
}

function generateHintMcqPuzzle(n) {
  const questions = [
    `Bu öğrencinin sınav notu 0–100 aralığındadır. Doğru not hangisi?`,
    `Not, hem 50'den büyük hem 100'den küçük veya eşit bir tam sayı olabilir. Hangisi?`,
    `Aşağıdakilerden biri bu sınavın notudur:`,
    `Sınav sonucu aşağıdaki seçeneklerden biridir:`,
    `Öğretmenin kaydettiği not (0–100) hangisidir?`,
  ];

  if (n >= 50) {
    questions.push(`Not 50 veya daha yüksektir. Hangisi doğru?`);
  }
  if (n < 50) {
    questions.push(`Not 50'nin altındadır. Hangisi doğru?`);
  }
  if (n % 2 === 0) {
    questions.push(`Not çift bir sayıdır. Hangisi?`);
  } else {
    questions.push(`Not tek bir sayıdır. Hangisi?`);
  }

  return {
    question: questions[Math.floor(Math.random() * questions.length)],
    choices: pickNumericChoices(n, 4),
    answer: n,
  };
}

function pickNumericChoices(correct, count) {
  const choices = new Set([correct]);
  const offsets = [3, 5, 7, 9, 11, 13, 15, 17, -3, -5, -7, -9, -11];

  shuffle(offsets);
  for (const off of offsets) {
    if (choices.size >= count) break;
    let fake = correct + off;
    fake = Math.max(0, Math.min(100, fake));
    if (fake !== correct) choices.add(fake);
  }

  const pool = [];
  for (let i = 0; i <= 100; i++) {
    if (i !== correct) pool.push(i);
  }
  shuffle(pool);
  for (const v of pool) {
    if (choices.size >= count) break;
    choices.add(v);
  }

  return shuffle([...choices]);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
