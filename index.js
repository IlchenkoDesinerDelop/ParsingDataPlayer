const { Client } = require('pg');
const fs = require('fs');
const csv = require('csv-parser');

// Конфигурация подключения к базе данных
const client = new Client({
  host: 'localhost',
  user: 'postgres', // Замените на ваше имя пользователя
  password: '1010', // Замените на ваш пароль
  database: 'playerdatabase', // Замените на вашу базу данных
  port: 5432,
});

// Функция для создания таблицы
async function createTable() {
  await client.connect();

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      nickname VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      registered INTEGER NOT NULL,
      status VARCHAR(50) NOT NULL
    );
  `

  try {
    await client.query(createTableQuery);
    console.log("Таблица 'players' успешно создана.");
  } catch (error) {
    console.error("Ошибка при создании таблицы:", error);
  }
}

// Функция для импорта данных из CSV
async function importDataFromCSV(filePath) {
    const results = [];
  
    fs.createReadStream(filePath)
      .pipe(csv({ separator: ';' })) // Указываем разделитель как ';'
      .on('data', (data) => {
        // Преобразуем дату в UNIX timestamp (INTEGER)
        const registeredDate = data.registered.split('.').reverse().join('-'); // Преобразуем формат даты
        const registeredTimestamp = Math.floor(new Date(registeredDate).getTime() / 1000); // Получаем UNIX timestamp
        
        results.push({
          nickname: data.nickname,
          email: data.email,
          registered: registeredTimestamp,
          status: data.status,
        });
      })
      .on('end', async () => {
        for (const player of results) {
          // Проверяем, существует ли игрок с таким ником
          const checkQuery = `SELECT * FROM players WHERE nickname = $1;`
          
          try {
            const checkRes = await client.query(checkQuery, [player.nickname]);
            if (checkRes.rows.length === 0) { // Если запись не найдена
              const insertQuery = `
                INSERT INTO players (nickname, email, registered, status) 
                VALUES ($1, $2, $3, $4);`
              await client.query(insertQuery, [player.nickname, player.email, player.registered, player.status]);
              console.log('Запись для игрока `${player.nickname} добавлена.`');
            } else {
              console.log('Игрок `${player.nickname} уже существует. Пропуск.`');
            }
          } catch (error) {
            console.error("Ошибка при добавлении данных:", error);
          }
        }
        console.log("Импорт данных завершен.");
        await selectPlayersWithStatusOn();
        await client.end(); // Закрываем подключение
      });
  }
  

// Функция для выбора игроков со статусом "On" в порядке времени регистрации
async function selectPlayersWithStatusOn() {
  const selectQuery = `
  SELECT * FROM players 
  WHERE status = 'On' 
  ORDER BY registered;`

try {
  const res = await client.query(selectQuery);
  console.log("Игроки со статусом 'On':");
  console.table(res.rows); // Выводим результаты в виде таблицы
} catch (error) {
  console.error("Ошибка при выборе данных:", error);
}
}

// Основная функция для создания таблицы и импорта данных
async function main() {
try {
  await createTable();
  await importDataFromCSV('players.csv'); // Убедитесь, что файл players.csv находится в той же директории
} catch (err) {
  console.error(err);
}
}

// Запуск основной функции
main();