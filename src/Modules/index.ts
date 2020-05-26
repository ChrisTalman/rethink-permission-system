'use strict';

// Internal Modules
import { isUserAuthorisedByRange } from './Range';
import { isUserAuthorisedBySubject } from './Subject';

// Types
import { RDatum } from 'rethinkdb-ts';
interface Queries <GenericUser extends any, GenericPermissionTargetEntityType extends string>
{
	user: ({domainId, userId}: {domainId: string, userId: string}) => RDatum<GenericUser>;
	globalAuthorised?: ({domainId, userId, user}: {domainId: string, userId: string, user: RDatum<GenericUser>}) => RDatum <boolean>;
	organisationAuthorised?: ({domainId, userId, user}: {domainId: string, userId: string, user: RDatum<GenericUser>}) => RDatum <boolean>;
	userRoles: ({domainId, userId, user}: {domainId: string, userId: string, user: RDatum<GenericUser>}) => RDatum <UserRoles <GenericPermissionTargetEntityType>>;
};
interface Indexes
{
	/** [ domainId, permission type, negated, user role ID, user role type, deleted ] */
	range: string;
	/** [ domainId, permission type, negated, user role ID, user role type, subject entity ID, subject entity type, deleted ] */
	subject: string;
};
export interface Permissions <PermissionTargetEntityType extends string> extends Array<Permission <PermissionTargetEntityType>> {};
export interface Permission <PermissionTargetEntityType extends string>
{
	id: string;
	type: string;
	domainId: string;
	/** The entity which is authorised to take an action. */
	agent: PermissionTargetEntity <PermissionTargetEntityType>;
	/** The entity on which the agent entity can take an action. */
	subject?: PermissionTargetEntity <PermissionTargetEntityType>;
	/** Determines whether permission should be denied for agent, negating any other permissions granting permission. */
	negated?: boolean;
	deleted?: true;
};
export interface PermissionTargetEntity <PermissionTargetEntityType extends string>
{
	id: string;
	type: PermissionTargetEntity <PermissionTargetEntityType>;
};
interface UserRoles <PermissionTargetEntityType extends string> extends Array<UserRole <PermissionTargetEntityType>> {};
interface UserRole <PermissionTargetEntityType extends string>
{
	id: RDatum<string>;
	type: PermissionTargetEntityType;
};


export class PermissionSystem <GenericUser extends any, GenericPermissionTypes extends Array<string>, GenericPermissionTargetEntityType extends string, GenericTargetEntity extends PermissionTargetEntity <GenericPermissionTargetEntityType>>
{
	public readonly table: string;
	public readonly indexes: Indexes;
	public readonly queries: Queries <GenericUser, GenericPermissionTargetEntityType>;
	public isAuthorisedByRange = isUserAuthorisedByRange;
	public isUserAuthorisedBySubject = isUserAuthorisedBySubject;
	constructor({table, indexes, queries}: {table: string, indexes: Indexes, queries: Queries <GenericUser, GenericPermissionTargetEntityType>})
	{
		this.table = table;
		this.indexes = indexes;
		this.queries = queries;
	};
};