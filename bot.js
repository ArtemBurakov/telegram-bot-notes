const { Bot, session } = require('grammy')
const { MenuTemplate, MenuMiddleware, createBackMainMenuButtons } = require('grammy-inline-menu')
const { StatelessQuestion } = require('@grammyjs/stateless-question')
const userModel = require('./src/models/user.model')
const hometaskModel = require('./src/models/hometask.model')
const noteModel = require('./src/models/note.model')
require('dotenv').config()

const DELETED_STATUS = 0
const ACTIVE_STATUS = 10
const DONE_STATUS = 20


//----------------------------------------------- User -----------------------------------------------

// Create User
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

// Is User admin
const isAdmin = async (ctx) => {
	const user_id = ctx.message.from.id
	const user = await getUser(user_id)
	user.role == 'Admin' ? ctx.session.isAdmin = false : ctx.session.isAdmin = true
}

// Get User
const getUser = async (user_id) => {
	try {
		const result = await userModel.findOne({user_id})
		return result
	} catch (error) {
		console.log(error)
	}
}
//----------------------------------------------------------------------------------------------------


//----------------------------------------------- Note -----------------------------------------------

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
			note_view = `📕 ${note_name}\n\n 📎 ${note_text}\n\n 😬 Your note is missing!\n`
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

	const pageIndex = (context.session.page_note ?? 1) - 1
	const currentPageEntries = result.slice(pageIndex * ENTRIES_PER_PAGE_NOTE, (pageIndex + ENTRIES_PER_PAGE_NOTE) * 1)
	context.session.selectedNote = currentPageEntries[0]
	context.session.notes_length = result.length

	return await noteView(context)
}
//-----------------------------------------------------------------------------------------------------------------



//----------------------------------------------- Hometask -----------------------------------------------

// New hometask
const newHometask = async (context) => {
	const user_id = context.from.id
	const name = context.session.hometask_name
	const text = context.session.hometask_text
	const deadline_at = await timestampToMilliseconds(context.session.hometask_time)

	try {
		await hometaskModel.create(user_id, name, text, deadline_at)
		context.session.page = null
		await context.reply('New hometask added successful!')
	} catch (error) {
		console.log(error)
		await context.reply('Something has gone wrong.')
	}
}

// Delete hometask
const deleteHometask = async (context) => {
	const id = context.session.selectedHometask.id

	try {
		await hometaskModel.update({status: DELETED_STATUS}, id)
		context.session.page = null
		await context.reply('Hometask deleted!')
	} catch (error) {
		console.log(error)
		await context.reply('Something has gone wrong.')
	}
}

// Update hometask
const updateHometask = async (context) => {
	const id = context.session.selectedHometask.id

	try {
		switch (context.session.hometask_update_type) {
			case 'name':
				await hometaskModel.update({name: context.message.text}, id)
				break

			case 'text':
				await hometaskModel.update({text: context.message.text}, id)
				break

			case 'time':
				const time = await timestampToMilliseconds(context.message.text)
				await hometaskModel.update({deadline_at: time}, id)
				break

			case 'status':
				await hometaskModel.update({status: context.session.hometask_status}, id)
				context.session.page = null
				break
		}
		await context.reply('Hometask updated!')
	} catch (error) {
		console.log(error)
		await context.reply('Something has gone wrong.')
	}
}

// Get list of hometask
const getHometask = async (context) => {
	try {
		const result = await hometaskModel.find(ACTIVE_STATUS)
		return result
	} catch (error) {
		console.log('Error `getHometask` -> ' + error)
	}
}

// Get list of hometask name
const getHometasksName = async (context) => {
	try {
		let hometasksArray = []
		if (context.session.hometasks_length)
			hometasksArray = Array(context.session.hometasks_length).fill('👀 View hometask')

		return hometasksArray
	} catch (error) {
		console.log('Error `getHometasksName` -> ' + error)
	}
}

// Hometask view
const hometaskView = async (context) => {
	let hometask_view = ``
	const hometask_name = context.session.selectedHometask.name
	const hometask_text = context.session.selectedHometask.text
	const deadline_at = context.session.selectedHometask.deadline_at
	const user = await getUser(context.session.selectedHometask.user_id)
	const recentlyAdded = await isRecentlyAdded(context)

	if (deadline_at) {
		const date = await convertMS(deadline_at*1000)

		if (date) {
			if (recentlyAdded) {
				hometask_view = `🔥 New hometask\n\n 📒 ${hometask_name}\n\n 📎 ${hometask_text}\n\n 👤 Created by: ${user.first_name}\n 💣 Time left:${date.day}${date.hour}${date.minute}${date.seconds}\n`
			} else {
				hometask_view = `📒 ${hometask_name}\n\n 📎 ${hometask_text}\n\n 👤 Created by: ${user.first_name}\n 💣 Time left:${date.day}${date.hour}${date.minute}${date.seconds}\n`
			}
		} else {
			hometask_view = `📕 ${hometask_name}\n\n 📎 ${hometask_text}\n\n 👤 Created by: ${user.first_name}\n 🪖🧳 Your hometask is missing!\n`
		}
	} else {
		if (recentlyAdded) {
			hometask_view = `🔥 New hometask\n\n 📒 ${hometask_name}\n\n 📎 ${hometask_text}\n\n 👤 Created by: ${user.first_name}\n`
		} else {
			hometask_view = `📒 ${hometask_name}\n\n 📎 ${hometask_text}\n\n 👤 Created by: ${user.first_name}\n`
		}
	}

	return hometask_view
}

// Menu body hometask
const menuBodyHometask = async (context) => {
	const emptyTextSubject = 'Currently you do not have hometask. Try to add a new one.'

	const result = await getHometask(context)
	if (!result.length) {
		context.session.hometasks_length = result.length
		return emptyTextSubject
	}

	const pageIndex = (context.session.page_hometask ?? 1) - 1
	const currentPageEntries = result.slice(pageIndex * ENTRIES_PER_PAGE_HOMETASK, (pageIndex + ENTRIES_PER_PAGE_HOMETASK) * 1)
	context.session.selectedHometask = currentPageEntries[0]
	context.session.hometasks_length = result.length

	return await hometaskView(context)
}
//-----------------------------------------------------------------------------------------------------------------



// Is recently added
const isRecentlyAdded = async (context) => {
	const date = Date.now();
	const millisecondsInHour = 3600000
	const numberOfHours = 8
	const new_hometask_status_duration = millisecondsInHour * numberOfHours
	const created_at = (context.session.selectedHometask.created_at)*1000

	const createdDifference = date - created_at
	if (createdDifference <= new_hometask_status_duration)
		return true

	return false
}

// Conver timestamp in human readable date
const convertMS = async (deadline) => {
	let date = Date.now();

	let milliseconds = deadline - date;

	if (milliseconds < 0) return false;

	let day, hour, minute, seconds;
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
const newNoteUpdateHandler = new StatelessQuestion('update_note', async (context) => {
	await updateNote(context)
	await menuMiddleware.replyToContext(context, `/notes/note:👀 View/`)
})

const updateNoteMenu = new MenuTemplate(menuBodyNotes)
updateNoteMenu.interact('📒 Update note name', 'note_name', {
	do: async (context) => {
		context.session.note_update_type = 'name'
		const noteName = 'OK. Send me the new name for your note.'
		await newNoteUpdateHandler.replyWithMarkdown(context, noteName)
		return false
	}
})
updateNoteMenu.interact('📎 Update note text', 'note_text', {
	do: async (context) => {
		context.session.note_update_type = 'text'
		const noteText = 'OK. Send me the new text for your note.'
		await newNoteUpdateHandler.replyWithMarkdown(context, noteText)
		return false
	}
})
updateNoteMenu.interact('⏰ Update note time', 'note_time', {
	do: async (context) => {
		context.session.note_update_type = 'time'
		const noteTime = 'OK. Send me the new time (also deadline time/due to) for your note. You have two options: the first is to specify the date for example: \`2022-01-10 14:45\` (the time need to be in \`24 hours format\`), the second does not specify the time, ie write \`0\` and your note will be without the attached time.'
		await newNoteUpdateHandler.replyWithMarkdown(context, noteTime)
		return false
	}
})
updateNoteMenu.manualRow(createBackMainMenuButtons())
//------------------------------------------------------------------------------------------------------------//



//------------------------------------------------- New Note -------------------------------------------------//
const newNoteNameHandler = new StatelessQuestion('new_name', async (context) => {
	context.session.note_name = context.message.text
	const noteText = 'OK. Send me the text for your note.'
	await newNoteTextHandler.replyWithMarkdown(context, noteText)
	return false
})

const newNoteTextHandler = new StatelessQuestion('new_text', async (context) => {
	context.session.note_text = context.message.text
	const noteText = 'OK. Send me the time (also deadline time/due to) for your note. You have two options: the first is to specify the date for example: \`2022-01-10 14:45\` (the time need to be in \`24 hours format\`), the second does not specify the time, ie write \`0\` and your note will be without the attached time.'
	await newNoteTimeHandler.replyWithMarkdown(context, noteText)
	return false
})

const newNoteTimeHandler = new StatelessQuestion('new_time', async (context) => {
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
	getCurrentPage: context => context.session.page_note,
	setPage: (context, page) => {
	  context.session.page_note = page
	}
})
notesMenu.interact('🪄 Add a new note', 'new_note', {
	do: async (context) => {
		const noteName = 'OK. Send me the name for your note.'
		await newNoteNameHandler.replyWithMarkdown(context, noteName)
		return false
	}
})
notesMenu.manualRow(createBackMainMenuButtons())
// Set Notes menu as submenu in MainMenu
mainMenu.submenu('🔐 Private Notes', 'notes', notesMenu)
//------------------------------------------------------------------------------------------------------------//



//------------------------------------------------- Delete Hometask ----------------------------------------------//
const deleteHometaskMenu = new MenuTemplate('You are about to delete your hometask. Is that correct?')
deleteHometaskMenu.interact('✅ Yes, delete the hometask', 'yes', {
	do: async (ctx) => {
		await deleteHometask(ctx)
		await menuMiddleware.replyToContext(ctx, '/hometasks/')
		return false
	}
})
deleteHometaskMenu.interact('❌ Nope, nevermind', 'no', {
	do: async (ctx) => {
		await menuMiddleware.replyToContext(ctx, `/hometasks/hometask:👀 View hometask/`)
		return false
	}
})
deleteHometaskMenu.manualRow(createBackMainMenuButtons())
//-----------------------------------------------------------------------------------------------------------//



//------------------------------------------------- Update Hometask ----------------------------------------------//
const newHometaskUpdateHandler = new StatelessQuestion('update_hometask', async (context) => {
	await updateHometask(context)
	await menuMiddleware.replyToContext(context, `/hometasks/hometask:👀 View hometask/`)
})

const updateHometaskMenu = new MenuTemplate(menuBodyHometask)
updateHometaskMenu.interact('📒 Update hometask name', 'hometask_name', {
	do: async (context) => {
		context.session.hometask_update_type = 'name'
		const hometaskName = 'OK. Send me the new name for your hometask.'
		await newHometaskUpdateHandler.replyWithMarkdown(context, hometaskName)
		return false
	}
})
updateHometaskMenu.interact('📎 Update hometask text', 'hometask_text', {
	do: async (context) => {
		context.session.hometask_update_type = 'text'
		const hometaskText = 'OK. Send me the new text for your hometask.'
		await newHometaskUpdateHandler.replyWithMarkdown(context, hometaskText)
		return false
	}
})
updateHometaskMenu.interact('⏰ Update hometask time', 'hometask_time', {
	do: async (context) => {
		context.session.hometask_update_type = 'time'
		const hometaskTime = 'OK. Send me the new time (also deadline time/due to) for your hometask. You have two options: the first is to specify the date for example: \`2022-01-10 14:45\` (the time need to be in \`24 hours format\`), the second does not specify the time, ie write \`0\` and your hometask will be without the attached time.'
		await newHometaskUpdateHandler.replyWithMarkdown(context, hometaskTime)
		return false
	}
})
updateHometaskMenu.manualRow(createBackMainMenuButtons())
//------------------------------------------------------------------------------------------------------------//



//------------------------------------------------- New Hometask -------------------------------------------------//
const newHometaskNameHandler = new StatelessQuestion('new_name_hometask', async (context) => {
	context.session.hometask_name = context.message.text
	const hometaskText = 'OK. Send me the text for your hometask.'
	await newHometaskTextHandler.replyWithMarkdown(context, hometaskText)
	return false
})

const newHometaskTextHandler = new StatelessQuestion('new_text_hometask', async (context) => {
	context.session.hometask_text = context.message.text
	const hometaskText = 'OK. Send me the time (also deadline time/due to) for your hometask. You have two options: the first is to specify the date for example: \`2022-01-10 14:45\` (the time need to be in \`24 hours format\`), the second does not specify the time, ie write \`0\` and your hometask will be without the attached time.'
	await newHometaskTimeHandler.replyWithMarkdown(context, hometaskText)
	return false
})

const newHometaskTimeHandler = new StatelessQuestion('new_time_hometask', async (context) => {
	context.session.hometask_time = context.message.text
	await newHometask(context)
	await menuMiddleware.replyToContext(context, '/hometasks/')
})
//------------------------------------------------------------------------------------------------------------//



//------------------------------------------------- Hometask ----------------------------------------------//
const ENTRIES_PER_PAGE_HOMETASK = 1

const detailsHometaskTemplate = new MenuTemplate(menuBodyHometask)
detailsHometaskTemplate.interact('✅ Done', 'done', {
	hide: ctx => ctx.session.isAdmin,
	do: async ctx => {
		ctx.session.hometask_update_type = 'status'
		ctx.session.hometask_status = DONE_STATUS
		await updateHometask(ctx)
		await menuMiddleware.replyToContext(ctx, '/hometasks/')
		return false
	}
})
detailsHometaskTemplate.submenu('✏️ Update', 'update', updateHometaskMenu, {
	hide: ctx => ctx.session.isAdmin
})
detailsHometaskTemplate.submenu('🗑 Delete', 'delete', deleteHometaskMenu, {
	hide: ctx => ctx.session.isAdmin
})
detailsHometaskTemplate.manualRow(createBackMainMenuButtons())

// Hometask menu
const hometaskMenu = new MenuTemplate(menuBodyHometask)
hometaskMenu.chooseIntoSubmenu('hometask', (context) => getHometasksName(context), detailsHometaskTemplate, {
	maxRows: 1,
	columns: ENTRIES_PER_PAGE_HOMETASK,
	disableChoiceExistsCheck: true,
	getCurrentPage: context => context.session.page_hometask,
	setPage: (context, page) => {
	  context.session.page_hometask = page
	}
})
hometaskMenu.interact('🪄 Add a new hometask', 'new_hometask', {
	hide: ctx => ctx.session.isAdmin,
	do: async (context) => {
		const hometaskName = 'OK. Send me the name for your hometask.'
		await newHometaskNameHandler.replyWithMarkdown(context, hometaskName)
		return false
	}
})
hometaskMenu.manualRow(createBackMainMenuButtons())
// Set Hometask menu as submenu in MainMenu
mainMenu.submenu('📚 Your hometask [beta]', 'hometasks', hometaskMenu)
//------------------------------------------------------------------------------------------------------------------//



const menuMiddleware = new MenuMiddleware('/', mainMenu)
console.log(menuMiddleware.tree())

const bot = new Bot(process.env.TELEGRAM_TOKEN)

bot.on('callback_query:data', async (ctx, next) => {
	console.log('another callbackQuery happened', ctx.callbackQuery.data.length, ctx.callbackQuery.data)
	return next()
})

const initial = () => {
	return {
		isAdmin: true,
		selectedNote: null,
		selectedHometask: null,
		page_hometask: null,
		page_note: null,
		notes_length: null,
		hometasks_length: null,
		note_update_type: null,
		hometask_update_type: null,
		note_name: null,
		note_text: null,
		note_time: null,
		note_status: null,
		hometask_name: null,
		hometask_text: null,
		hometask_time: null,
		hometask_status: null
	};
}
bot.use(session({ initial }));

bot.use(menuMiddleware.middleware())
bot.use(newNoteUpdateHandler.middleware())
bot.use(newNoteNameHandler.middleware())
bot.use(newNoteTextHandler.middleware())
bot.use(newNoteTimeHandler.middleware())

bot.use(newHometaskUpdateHandler.middleware())
bot.use(newHometaskNameHandler.middleware())
bot.use(newHometaskTextHandler.middleware())
bot.use(newHometaskTimeHandler.middleware())
bot.catch(error => {
	console.log('bot error', error)
})

bot.command('start', async ctx => {
	menuMiddleware.replyToContext(ctx)
	await createUser(ctx)
	await isAdmin(ctx)
})

async function startup() {
	await bot.start({
		onStart: botInfo => {
			console.log(new Date(), 'Bot starts as', botInfo.username)
		},
	})
}

startup()
