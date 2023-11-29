#[macro_use] extern crate rocket;

use rocket::{State, Shutdown};
use rocket::fs::{relative, FileServer};
use rocket::form::Form;
use rocket::response::stream::{EventStream, Event};
use rocket::serde::{Serialize, Deserialize};
use rocket::tokio::sync::broadcast::{channel, Sender, error::RecvError};
use rocket::tokio::select;


use rocket_db_pools::{Database, Connection};
use rocket_db_pools::sqlx::{self, Row};


#[derive(Database)]
#[database("database")]
struct Logs(sqlx::SqlitePool);

#[get("/<id>")]
async fn read(mut db: Connection<Logs>, id: i64) -> Option<String> {
   sqlx::query("SELECT username FROM Messages WHERE rowid = ?").bind(id)
       .fetch_one(&mut *db).await
       .and_then(|r| Ok(r.try_get(0)?))
       .ok()

}

#[get("/read/<id>")]
async fn read_messages(mut db: Connection<Logs>, id: i64) -> &'static str{

   let result = sqlx::query("SELECT * FROM Messages WHERE rowid = ?").bind(id)
       .fetch_all(&mut *db).await.unwrap();

    let mut message_list: Vec<Message> = Vec::new();

    for row in result{
        let message = Message {
            room: row.try_get(0).unwrap(),
            username: row.try_get(1).unwrap(),
            message: row.try_get(2).unwrap()
        };
        message_list.push(message);
    }

    println!("{:?}", message_list);

    "test, read function"
}

#[derive(Debug, Clone, FromForm, Serialize, Deserialize)]
#[cfg_attr(test, derive(PartialEq, UriDisplayQuery))]
#[serde(crate = "rocket::serde")]
struct Message {
    #[field(validate = len(..30))]
    pub room: String,
    #[field(validate = len(..40))]
    pub username: String,
    pub message: String,
}

#[post("/message", data = "<form>")]
async fn post(mut db: Connection<Logs>, form: Form<Message>, queue: &State<Sender<Message>>) {
    // A send 'fails' if there are no active subscribers. That's okay.
    let message = form.into_inner();

    sqlx::query(
        "INSERT INTO messages (room, username, message) VALUES (?, ?, ?)")
    .bind(&message.room)
    .bind(&message.username)
    .bind(&message.message)
    .execute(&mut *db)
    .await
    .expect("Failed to insert message into the database");
    
    let _res = queue.send(message);
}

#[get("/events")]
async fn events(queue: &State<Sender<Message>>, mut end: Shutdown) -> EventStream![] {
    let mut rx = queue.subscribe();
    EventStream! {
        loop {
            let msg = select! {
                msg = rx.recv() => match msg {
                    Ok(msg) => msg,
                    Err(RecvError::Closed) => break,
                    Err(RecvError::Lagged(_)) => continue,
                },
                _ = &mut end => break,
            };
            yield Event::json(&msg);
        }
    }
}

#[get("/getdb")]
async fn getdb(mut db: Connection<Logs>) -> EventStream![] {

    EventStream! {

        let result = sqlx::query("SELECT * FROM Messages")
        .fetch_all(&mut *db).await.unwrap();

        let mut message_list: Vec<Message> = Vec::new();

        for row in result{
            let message = Message {
                room: row.try_get(0).unwrap(),
                username: row.try_get(1).unwrap(),
                message: row.try_get(2).unwrap()
            };
            message_list.push(message);
        }

        for db_msg in message_list {
            yield Event::json(&db_msg);
        }
        yield Event::json(&"");
        

    }
}

#[launch]
fn rocket() -> _ {
    rocket::build().attach(Logs::init())
    .manage(channel::<Message>(1024).0)
    .mount("/", routes![post, getdb, events])
    .mount("/", FileServer::from(relative!("static")))
    .mount("/", routes![read])
    .mount("/", routes![read_messages])
}
