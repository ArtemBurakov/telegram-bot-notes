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

// New note
const newNote = async (context) => {
	const user_id = context.from.id
	const name = context.session.note_name
	const text = context.session.note_text
	const deadline_at = await timestampToMilliseconds(context.session.note_time)

	try {
		await noteModel.create(user_id, name, text, deadline_at)
		context.session.page = null
		await context.reply('New note added successful!')
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
				await noteModel.update({status: context.session.note_status}, id, user_id)
				context.session.page = null
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
	try {
		let notesArray = []
		if (context.session.notes_length)
			notesArray = Array(context.session.notes_length).fill('👀 View')

		return notesArray
	} catch (error) {
		console.log('Error `getNotesHame` -> ' + error)
	}
}

// Note view
const noteView = async (context) => {
	let note_view = ``
	const note_name = context.session.selectedNote.name
	const note_text = context.session.selectedNote.text
	const deadline_at = context.session.selectedNote.deadline_at

	if (deadline_at) {
		const date = await convertMS(deadline_at*1000)

		if (date) {
			note_view = `📒 ${note_name}\n\n 📎 ${note_text}\n\n 💣 Time left:${date.day}${date.hour}${date.minute}${date.seconds}\n`
		} else {
			note_view = `📒 ${note_name}\n\n 📎 ${note_text}\n\n ❌ Your note is missing!\n`
		}
	} else {
		note_view = `📒 ${note_name}\n\n 📎 ${note_text}\n`
	}

	return note_view
}

// Menu body notes
const menuBodyNotes = async (context) => {
	const emptyTextNotes = 'Currently you do not have notes. Try to add a new one.'

	const result = await getNotes(context)
	if (!result.length) {
		context.session.notes_length = result.length
		return emptyTextNotes
	}

	const pageIndex = (context.session.page ?? 1) - 1
	const currentPageEntries = result.slice(pageIndex * ENTRIES_PER_PAGE_NOTE, (pageIndex + ENTRIES_PER_PAGE_NOTE) * 1)
	context.session.selectedNote = currentPageEntries[0]
	context.session.notes_length = result.length

	return await noteView(context)
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
		day: ` ${day} days`,
		hour: '',
		minute: '',
		seconds: ''
	  }
	}

	if (day <= 5 && day >= 1) {
	  return {
		day: ` ${day} days`,
		hour: ` ${hour} hours`,
		minute: '',
		seconds: ''
	  }
	}

	if (day <= 1 && hour >= 1) {
	  return {
		day: '',
		hour: ` ${hour} hours`,
		minute: minute == 0 ? '' : ` ${minute} minutes`,
		seconds: ''
	  }
	}

	if (hour <= 1) {
	  return {
		day: '',
		hour: '',
		minute: minute == 0 ? '' : ` ${minute} minutes`,
		seconds: seconds == 0 ? '' :  ` ${seconds} seconds`
	  }
	}
}

// Convert timestamp to milliseconds
const timestampToMilliseconds = async (timestamp) => {
	if (timestamp) {
		const time = Math.floor(new Date(`${timestamp} +0000 GMT +0200`) / 1000)
		return time
	}

	return NULL
}



//-------------------- Main menu --------------------//
const mainMenu = new MenuTemplate(() => 'Main Menu')
//---------------------------------------------------//



//------------------------------------------------- Delete Note ----------------------------------------------//
const deleteNoteMenu = new MenuTemplate('You are about to delete your note. Is that correct?')
deleteNoteMenu.interact('✅ Yes, delete the note', 'yes', {
	do: async (ctx) => {
		await deleteNote(ctx)
		await menuMiddleware.replyToContext(ctx, '/notes/')
		return false
	}
})
deleteNoteMenu.interact('❌ Nope, nevermind', 'no', {
	do: async (ctx) => {
		await menuMiddleware.replyToContext(ctx, `/notes/note:👀 View/`)
		return false
	}
})
deleteNoteMenu.manualRow(createBackMainMenuButtons())
//-----------------------------------------------------------------------------------------------------------//



//------------------------------------------------- Update Note ----------------------------------------------//
const newNoteUpdateHandler = new StatelessQuestion('update_note', async (context, additionalState) => {
	await updateNote(context)
	await menuMiddleware.replyToContext(context, `/notes/note:👀 View/`)
})

const updateNoteMenu = new MenuTemplate(menuBodyNotes)
updateNoteMenu.interact('📒 Update note name', 'note_name', {
	do: async (context, path) => {
		context.session.note_update_type = 'name'
		const noteName = 'OK. Send me the new name for your note.'
		const additionalNoteState = getMenuOfPath(path)
		await newNoteUpdateHandler.replyWithMarkdown(context, noteName, additionalNoteState)
		return false
	}
})
updateNoteMenu.interact('📎 Update note text', 'note_text', {
	do: async (context, path) => {
		context.session.note_update_type = 'text'
		const noteText = 'OK. Send me the new text for your note.'
		const additionalNoteState = getMenuOfPath(path)
		await newNoteUpdateHandler.replyWithMarkdown(context, noteText, additionalNoteState)
		return false
	}
})
updateNoteMenu.interact('⏰ Update note time', 'note_time', {
	do: async (context, path) => {
		context.session.note_update_type = 'time'
		const noteTime = 'OK. Send me the new time (also deadline time/due to) for your note. You have two options: the first is to specify the date for example: \`2022-01-10 14:45\` (the time need to be in \`24 hours format\`), the second does not specify the time, ie write \`0\` and your note will be without the attached time.'
		const additionalNoteState = getMenuOfPath(path)
		await newNoteUpdateHandler.replyWithMarkdown(context, noteTime, additionalNoteState)
		return false
	}
})
updateNoteMenu.manualRow(createBackMainMenuButtons())
//------------------------------------------------------------------------------------------------------------//



//------------------------------------------------- New Note -------------------------------------------------//
const newNoteNameHandler = new StatelessQuestion('new_name', async (context, additionalNoteState) => {
	context.session.note_name = context.message.text
	const noteText = 'OK. Send me the text for your note.'
	const additionalNoteNameState = additionalNoteState
	await newNoteTextHandler.replyWithMarkdown(context, noteText, additionalNoteNameState)
	return false
})

const newNoteTextHandler = new StatelessQuestion('new_text', async (context, additionalNoteNameState) => {
	context.session.note_text = context.message.text
	const noteText = 'OK. Send me the time (also deadline time/due to) for your note. You have two options: the first is to specify the date for example: \`2022-01-10 14:45\` (the time need to be in \`24 hours format\`), the second does not specify the time, ie write \`0\` and your note will be without the attached time.'
	const additionalNoteTextState = additionalNoteNameState
	await newNoteTimeHandler.replyWithMarkdown(context, noteText, additionalNoteTextState)
	return false
})

const newNoteTimeHandler = new StatelessQuestion('new_time', async (context, additionalNoteTextState) => {
	context.session.note_time = context.message.text
	await newNote(context)
	await menuMiddleware.replyToContext(context, '/notes/')
})
//------------------------------------------------------------------------------------------------------------//



//------------------------------------------------ Notes -----------------------------------------------------//
const ENTRIES_PER_PAGE_NOTE = 1

const detailsNoteTemplate = new MenuTemplate(menuBodyNotes)
detailsNoteTemplate.interact('✅ Done', 'done', {
	do: async ctx => {
		ctx.session.note_update_type = 'status'
		ctx.session.note_status = DONE_STATUS
		await updateNote(ctx)
		await menuMiddleware.replyToContext(ctx, '/notes/')
		return false
	}
})
detailsNoteTemplate.submenu('✏️ Update', 'update', updateNoteMenu)
detailsNoteTemplate.submenu('🗑 Delete', 'delete', deleteNoteMenu)
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
notesMenu.interact('🪄 Add a new note', 'new_note', {
	do: async (context, path) => {
		const noteName = 'OK. Send me the name for your note.'
		const additionalNoteState = getMenuOfPath(path)
		await newNoteNameHandler.replyWithMarkdown(context, noteName, additionalNoteState)
		return false
	}
})
notesMenu.manualRow(createBackMainMenuButtons())
// Set Notes menu as submenu in MainMenu
mainMenu.submenu('🔐 Private Notes', 'notes', notesMenu)
//------------------------------------------------------------------------------------------------------------//



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
		await userModel.create(!username ? null : username, first_name, user_id)
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
	return {
		notes_length: null,
		selectedNote: null,
		note_update_type: null,
		note_name: null,
		note_text: null,
		note_time: null,
		note_status: null
	};
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
