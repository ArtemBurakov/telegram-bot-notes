const { Bot, session } = require('grammy')
const { MenuTemplate, MenuMiddleware, getMenuOfPath, createBackMainMenuButtons, replyMenuToContext } = require('grammy-inline-menu')
const { StatelessQuestion } = require('@grammyjs/stateless-question')
const userModel = require('./src/models/user.model')
const subjectModel = require('./src/models/subject.model')
const homeTaskModel = require('./src/models/hometask.model')
const noteModel = require('./src/models/note.model')
require('dotenv').config()

const DELETED_STATUS = 0
const ACTIVE_STATUS = 10
const DONE_STATUS = 20

// Convert timestamp to milliseconds
const timestampToMilliseconds = async (timestamp) => {
	if (timestamp) {
		const time = Math.floor(new Date(`${timestamp} +0000 GMT +0200`) / 1000)
		return time
	}

	return NULL
}

// New note
const newNote = async (context) => {
	const user_id = context.from.id
	const name = context.session.note_name
	const text = context.session.note_text
	const deadline_at = await timestampToMilliseconds(context.session.note_time)

	try {
		await noteModel.create(user_id, name, text, deadline_at)
		await context.reply('New hometask added successful!')
	} catch (error) {
		console.log(error)
		await context.reply('Something has gone wrong.')
	}
}

// Delete note
const deleteNote = async (context) => {
	const id = context.session.selectedNote.id
	const user_id = context.from.id

	try {
		await noteModel.update({status: DELETED_STATUS}, id, user_id)
		context.session.page = null
		await context.reply('Note deleted!')
	} catch (error) {
		console.log(error)
		await context.reply('Something has gone wrong.')
	}
}

// Update note
const updateNote = async (context) => {
	const id = context.session.selectedNote.id
	const user_id = context.from.id

	try {
		switch (context.session.note_update_type) {
			case 'name':
				await noteModel.update({name: context.message.text}, id, user_id)
				break

			case 'text':
				await noteModel.update({text: context.message.text}, id, user_id)
				break

			case 'time':
				const time = await timestampToMilliseconds(context.message.text)
				await noteModel.update({deadline_at: time}, id, user_id)
				break

			case 'status':
				await noteModel.update({status: context.message.text}, id, user_id)
				break
		}
		await context.reply('Note updated!')
	} catch (error) {
		console.log(error)
		await context.reply('Something has gone wrong.')
	}
}

// Get list of notes
const getNotes = async (context) => {
	const user_id = context.from.id

	try {
		const result = await noteModel.find(user_id, ACTIVE_STATUS)
		return result
	} catch (error) {
		console.log('Error `getNotes` -> ' + error)
	}
}

// Get list of notes name
const getNotesName = async (context) => {
	const user_id = context.from.id

	try {
		const result = await noteModel.find(user_id, ACTIVE_STATUS)

		let notesArray = []
		result.forEach(element => {
			notesArray.push(element.name)
		})
		return notesArray
	} catch (error) {
		console.log('Error `getNotes` -> ' + error)
	}
}

//Conver timestamp in human readable date
const convertMS = async (deadline) => {
	let date = Date.now();

	let milliseconds = deadline - date;

	if (milliseconds < 0) return false;

	let day, hour, minute, seconds, inTime;
	seconds = Math.floor(milliseconds / 1000);
	minute = Math.floor(seconds / 60);
	seconds = seconds % 60;
	hour = Math.floor(minute / 60);
	minute = minute % 60;
	day = Math.floor(hour / 24);
	hour = hour % 24;

	if (day >= 5) {
	  return {
		day: `${day} days`,
		hour: '',
		minute: '',
		seconds: ''
	  }
	}

	if (day <= 5 && day >= 1) {
	  return {
		day: `${day} days`,
		hour: `${hour} hours`,
		minute: '',
		seconds: ''
	  }
	}

	if (day <= 1 && hour >= 1) {
	  return {
		day: '',
		hour: `${hour} hours`,
		minute: minute == 0 ? '' : `${minute} minutes`,
		seconds: ''
	  }
	}

	if (hour <= 1) {
	  return {
		day: '',
		hour: '',
		minute: minute == 0 ? '' : `${minute} minutes`,
		seconds: seconds == 0 ? '' :  `${seconds} seconds`
	  }
	}
}

const noteView = async (context) => {
	let note_view = ``
	const note_name = context.session.selectedNote.name
	const note_text = context.session.selectedNote.text
	const deadline_at = context.session.selectedNote.deadline_at

	if (deadline_at) {
		const date = await convertMS(deadline_at*1000)

		if (date) {
			note_view = `📒 ${note_name}\n\n 📎 ${note_text}\n\n 💣 Time left: ${date.day} ${date.hour} ${date.minute} ${date.seconds}\n`
		} else {
			note_view = `📕 ${note_name}\n\n 📎 ${note_text}\n\n 💣 Time left: missing!\n`
		}
	} else {
		note_view = `📒 ${note_name}\n\n 📎 ${note_text}\n`
	}

	return note_view
}



//-------------------- Main menu --------------------//
const mainMenu = new MenuTemplate(() => 'Main Menu')
//---------------------------------------------------//







const deleteNoteMenu = new MenuTemplate('Are you sure you want to delete this note?')
deleteNoteMenu.interact('Yes, delete the note', 'delete_yes', {
	do: async (ctx) => {
		await deleteNote(ctx)
		await menuMiddleware.replyToContext(ctx, '/notes/')
		return false
	}
})
deleteNoteMenu.manualRow(createBackMainMenuButtons())









const newNoteUpdateHandler = new StatelessQuestion('update_note', async (context, additionalState) => {
	await updateNote(context)
	// await replyMenuToContext(notesMenu, context, additionalState)
	await menuMiddleware.replyToContext(context, '/notes/')
})

const updateNoteMenu = new MenuTemplate('Update this note')
updateNoteMenu.interact('Update note name', 'update_note_name', {
	do: async (context, path) => {
		context.session.note_update_type = 'name'
		const noteName = 'Tell me the name of your note.'
		const additionalNoteState = getMenuOfPath(path)
		await newNoteUpdateHandler.replyWithMarkdown(context, noteName, additionalNoteState)
		return false
	}
})
updateNoteMenu.interact('Update note text', 'update_note_text', {
	do: async (context, path) => {
		context.session.note_update_type = 'text'
		const noteText = 'Tell me the text of your note.'
		const additionalNoteState = getMenuOfPath(path)
		await newNoteUpdateHandler.replyWithMarkdown(context, noteText, additionalNoteState)
		return false
	}
})
updateNoteMenu.interact('Update note time', 'update_note_time', {
	do: async (context, path) => {
		context.session.note_update_type = 'time'
		const noteTime = 'Tell me the time of your note.'
		const additionalNoteState = getMenuOfPath(path)
		await newNoteUpdateHandler.replyWithMarkdown(context, noteTime, additionalNoteState)
		return false
	}
})
updateNoteMenu.manualRow(createBackMainMenuButtons())







//------------------------------------------------- Notes ----------------------------------------------//
const ENTRIES_PER_PAGE_NOTE = 1
const emptyTextNotes = 'Currently you do not have notes. Try to add a new one.'

const menuBodyNotes = async (context) => {
	const result = await getNotes(context)
	if (!result.length)
		return emptyTextNotes

	const pageIndex = (context.session.page ?? 1) - 1
	const currentPageEntries = result.slice(pageIndex * ENTRIES_PER_PAGE_NOTE, (pageIndex + ENTRIES_PER_PAGE_NOTE) * 1)
	context.session.selectedNote = currentPageEntries[0]

	return await noteView(context)
}

const detailsNoteTemplate = new MenuTemplate(menuBodyNotes)
detailsNoteTemplate.submenu('Update', 'update_note', updateNoteMenu)
detailsNoteTemplate.submenu('Delete', 'delete_note', deleteNoteMenu)
detailsNoteTemplate.manualRow(createBackMainMenuButtons())

// Note menu
const notesMenu = new MenuTemplate(menuBodyNotes)
notesMenu.chooseIntoSubmenu('note', (context) => getNotesName(context), detailsNoteTemplate, {
	maxRows: 1,
	columns: ENTRIES_PER_PAGE_NOTE,
	disableChoiceExistsCheck: true,
	getCurrentPage: context => context.session.page,
	setPage: (context, page) => {
	  context.session.page = page
	}
})
notesMenu.manualRow(createBackMainMenuButtons())
// Set Notes menu as submenu in MainMenu
mainMenu.submenu('🔐 Private Notes', 'notes', notesMenu)
//------------------------------------------------------------------------------------------------------//




















//------------------------------------------------- Manage Notes ---------------------------------------------//

const newNoteNameHandler = new StatelessQuestion('new_note_name', async (context, additionalNoteState) => {
	context.session.note_name = context.message.text
	const noteText = 'Tell me the text of your note.'
	const additionalNoteNameState = additionalNoteState
	await newNoteTextHandler.replyWithMarkdown(context, noteText, additionalNoteNameState)
	return false
})

const newNoteTextHandler = new StatelessQuestion('new_note_text', async (context, additionalNoteNameState) => {
	context.session.note_text = context.message.text
	const noteText = 'Tell me the deadline time of your note.'
	const additionalNoteTextState = additionalNoteNameState
	await newNoteTimeHandler.replyWithMarkdown(context, noteText, additionalNoteTextState)
	return false
})

const newNoteTimeHandler = new StatelessQuestion('new_note_time', async (context, additionalNoteTextState) => {
	context.session.note_time = context.message.text
	await newNote(context)
	//await replyMenuToContext(mainMenu, context, additionalNoteTextState)
	await menuMiddleware.replyToContext(context, '/notes/')
})

// Add manage notes menu
const manageNoteMenu = new MenuTemplate('Here you can manage your notes. For example: create a new note, change note, change priority or delete.')
manageNoteMenu.interact('🪄 Add a new note', 'new_note', {
	do: async (context, path) => {
		const noteName = 'Tell me the name of your note.'
		const additionalNoteState = getMenuOfPath(path)
		await newNoteNameHandler.replyWithMarkdown(context, noteName, additionalNoteState)
		return false
	}
})
manageNoteMenu.manualRow(createBackMainMenuButtons())
// Set Notes menu as submenu in MainMenu
mainMenu.submenu('🛠 Manage your private notes', 'manage_note', manageNoteMenu)
//------------------------------------------------------------------------------------------------------------//












//------------------------------------------------- Add Note ----------------------------------------------//

// // New note
// const newNote = async (context) => {
// 	const user_id = context.from.id
// 	const name = context.session.note_name
// 	const text = context.session.note_text
// 	const deadline_at = context.session.note_time

// 	try {
// 		await noteModel.create(user_id, name, text, deadline_at)
// 		await context.reply('New hometask added successful!')
// 	} catch (error) {
// 		console.log(error)
// 		await context.reply('Something has gone wrong.')
// 	}
// }

// const newNoteNameHandler = new StatelessQuestion('new_note_name', async (context, additionalNoteState) => {
// 	context.session.note_name = context.message.text
// 	const noteText = 'Tell me the text of your note.'
// 	const additionalNoteNameState = additionalNoteState
// 	await newNoteTextHandler.replyWithMarkdown(context, noteText, additionalNoteNameState)
// 	return false
// })

// const newNoteTextHandler = new StatelessQuestion('new_note_text', async (context, additionalNoteNameState) => {
// 	context.session.note_text = context.message.text
// 	const noteText = 'Tell me the deadline time of your note.'
// 	const additionalNoteTextState = additionalNoteNameState
// 	await newNoteTimeHandler.replyWithMarkdown(context, noteText, additionalNoteTextState)
// 	return false
// })

// const newNoteTimeHandler = new StatelessQuestion('new_note_time', async (context, additionalNoteTextState) => {
// 	context.session.note_time = context.message.text
// 	await newNote(context)
// 	//await replyMenuToContext(mainMenu, context, additionalNoteTextState)
// 	await menuMiddleware.replyToContext(context, '/notes/')
// })

// // Add note menu
// const addNoteMenu = new MenuTemplate('Here you can add new note simply by pressing add new note button below:')
// addNoteMenu.interact('Add a new note', 'new_note', {
// 	do: async (context, path) => {
// 		const noteName = 'Tell me the name of your note.'
// 		const additionalNoteState = getMenuOfPath(path)
// 		await newNoteNameHandler.replyWithMarkdown(context, noteName, additionalNoteState)
// 		return false
// 	}
// })
// addNoteMenu.manualRow(createBackMainMenuButtons())
// // Set Notes menu as submenu in MainMenu
// mainMenu.submenu('Add a new private note [beta]', 'add_note', addNoteMenu)
//---------------------------------------------------------------------------------------------------------//


















//------------------------------------------------- Selected Subject ----------------------------------------------//
// const ENTRIES_PER_PAGE_SUBJECT = 1
// const emptyTextSubject = 'Currently you do not have home task. Try to add a new one.'

// const getSubjectByName = async (context) => {
// 	const name = context.session.selected_subject_name
// 	console.log('Find by name ' + name)

// 	try {
// 		const result = await subjectModel.findOne({name})
// 		return result
// 	} catch (error) {
// 		console.log(error)
// 	}
// }

// // New hometask
// const newHomeTask = async (context) => {
// 	const user_id = context.from.id
// 	const subject = await getSubjectByName(context)
// 	const text = context.message.text

// 	try {
// 		await homeTaskModel.create(user_id, subject.id, text, 100)
// 		await context.reply('New hometask added successful!')
// 	} catch (error) {
// 		console.log(error)
// 		await context.reply('Something has gone wrong.')
// 	}
// }

// const newHomeTaskHandler = new StatelessQuestion('new_hometask', async (context, additionalHomeTaskState) => {
// 	await newHomeTask(context)
// 	await replyMenuToContext(selectedSubjectMenu, context, additionalHomeTaskState)
// })

// // Get list of hometask
// const getHometask = async (context) => {
// 	if (context.match[1])
// 		context.session.selected_subject_name = context.match[1]

// 	const user_id = context.from.id
// 	const subject = await getSubjectByName(context)

// 	try {
// 		const result = await homeTaskModel.find(user_id, subject.id, ACTIVE_STATUS)
// 		return result
// 	} catch (error) {
// 		console.log('Error `getHometask` -> ' + error)
// 	}
// }

// const menuBodySubject = async (context) => {
// 	const result = await getHometask(context)
// 	if (!result.length)
// 		return emptyTextSubject

// 	const pageIndex = (context.session.page ?? 1) - 1
// 	const currentPageEntries = result.slice(pageIndex * ENTRIES_PER_PAGE_SUBJECT, (pageIndex + ENTRIES_PER_PAGE_SUBJECT) * 1)

// 	const hometask_text = `📒 ${currentPageEntries[0].text}`
// 	return hometask_text
// }

// const detailsHomeTaskTemplate = new MenuTemplate('Details')
// detailsHomeTaskTemplate.manualRow(createBackMainMenuButtons())

// // Selected Subject menu
// const selectedSubjectMenu = new MenuTemplate(menuBodySubject)
// selectedSubjectMenu.chooseIntoSubmenu('details_hometask', (context) => getHometask(context), detailsHomeTaskTemplate, {
// 	maxRows: 1,
// 	columns: ENTRIES_PER_PAGE_SUBJECT,
// 	disableChoiceExistsCheck: true
// })
// selectedSubjectMenu.interact('✏️ Add a new hometask', 'new_hometask', {
// 	do: async (context, path) => {
// 		const hometaskNameText = 'Tell me the name of your hometask.'
// 		const additionalHomeTaskState = getMenuOfPath(path)
// 		await newHomeTaskHandler.replyWithMarkdown(context, hometaskNameText, additionalHomeTaskState)
// 		return false
// 	}
// })
// selectedSubjectMenu.manualRow(createBackMainMenuButtons())
//------------------------------------------------------------------------------------------------------------------//



















//------------------------------------------------- Subjects menu -------------------------------------------------//

// // New subject
// const newSubject = async (context) => {
// 	const user_id = context.from.id
// 	const name = context.message.text

// 	try {
// 		await subjectModel.create(user_id, name)
// 		await context.reply('New subject added successful!')
// 	} catch (error) {
// 		console.log(error)
// 		await context.reply('Something has gone wrong.')
// 	}
// }
// const newSubjectHandler = new StatelessQuestion('new_subject', async (context, additionalState) => {
// 	await newSubject(context)
// 	await replyMenuToContext(subjectsMenu, context, additionalState)
// })

// // Get list of subjects
// const getSubjects = async (context) => {
// 	const user_id = context.from.id

// 	try {
// 		const result = await subjectModel.find(user_id)

// 		let subjectsArray = []
// 		result.forEach(element => {
// 			subjectsArray.push(element.name)
// 		})
// 		return subjectsArray
// 	} catch (error) {
// 		console.log('Error `getSubjects` -> ' + error)
// 	}
// }

// Subjects menu
//const subjectsMenu = new MenuTemplate('Choose a subject from the list below:')
// subjectsMenu.chooseIntoSubmenu('subjects', (context) => getSubjects(context), selectedSubjectMenu, {
// 	columns: 1,
// 	disableChoiceExistsCheck: true,
// })
// subjectsMenu.interact('✏️ Add a new subject', 'new_subject', {
// 	do: async (context, path) => {
// 		const subjectText = 'Tell me the name of your new subject.'
// 		const additionalState = getMenuOfPath(path)
// 		await newSubjectHandler.replyWithMarkdown(context, subjectText, additionalState)
// 		return false
// 	}
// })
// subjectsMenu.manualRow(createBackMainMenuButtons())

// // Set Subjects menu as submenu in MainMenu
// mainMenu.submenu('📚 Your subjects [beta]', 'subjects', subjectsMenu)
//------------------------------------------------------------------------------------------------------------------//


















//-------------------- Create user --------------------//
const createUser = async (ctx) => {
	const username = ctx.message.from.username
	const first_name = ctx.message.from.first_name
	const user_id = ctx.message.from.id

	try {
		await userModel.create(username, first_name, user_id)
	} catch (error) {
		console.error('User already exist');
	}
}
//-----------------------------------------------------//




const menuMiddleware = new MenuMiddleware('/', mainMenu)
console.log(menuMiddleware.tree())

const bot = new Bot(process.env.TELEGRAM_TOKEN)

bot.on('callback_query:data', async (ctx, next) => {
	console.log('another callbackQuery happened', ctx.callbackQuery.data.length, ctx.callbackQuery.data)
	return next()
})

bot.command('start', async ctx => {
	menuMiddleware.replyToContext(ctx)
	await createUser(ctx)
})

const initial = () => {
	return { selectedNote: null, note_update_type: null, note_name: null, note_text: null, note_time: null };
}
bot.use(session({ initial }));

bot.use(menuMiddleware.middleware())
// bot.use(newSubjectHandler.middleware())
// bot.use(newHomeTaskHandler.middleware())
bot.use(newNoteUpdateHandler.middleware())
bot.use(newNoteNameHandler.middleware())
bot.use(newNoteTextHandler.middleware())
bot.use(newNoteTimeHandler.middleware())
bot.catch(error => {
	console.log('bot error', error)
})

async function startup() {
	await bot.start({
		onStart: botInfo => {
			console.log(new Date(), 'Bot starts as', botInfo.username)
		},
	})
}

startup()
