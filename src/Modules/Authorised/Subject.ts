'use strict';

// External Modules
import { r as RethinkDB } from 'rethinkdb-ts';

// Types
import { RDatum } from 'rethinkdb-ts';
import { PermissionSystem, Permission, PermissionTargetEntity, UserRoles } from 'src/Modules';
import { PermissionParameterEvaluation } from './';

// Constants
const NEGATED = true;
const NOT_NEGATED = false;
const NOT_DELETED = false;

export function generateUserAuthorisedBySubjectQuery <GenericPermissionType extends string, GenericTargetEntityType extends string, GenericTargetEntity extends PermissionTargetEntity <any>>
(
	{domainId, userRoles, permission, subject, system}:
	{
		domainId: string,
		userRoles: RDatum <UserRoles <GenericTargetEntityType>>,
		permission: RDatum <GenericPermissionType>,
		subject: RDatum <GenericTargetEntity>,
		system: PermissionSystem <any, any, any, any>
	}
)
{
	const query: RDatum <PermissionParameterEvaluation> = RethinkDB
		.expr
		(
			{
				granted: userRoles
					.concatMap
					(
						role => RethinkDB
							.table<Permission <any>>(system.table)
							.getAll
							(
								[ domainId, permission, NOT_NEGATED, role('id'), role('type'), subject('id'), subject('type'), NOT_DELETED ],
								{ index: system.indexes.subject }
							)
					)
					.count()
					.gt(0),
				negated: userRoles
					.concatMap
					(
						role => RethinkDB
							.table<Permission <any>>(system.table)
							.getAll
							(
								[ domainId, permission, NEGATED, role('id'), role('type'), subject('id'), subject('type'), NOT_DELETED ],
								{ index: system.indexes.subject }
							)
					)
					.count()
					.eq(0)
			}
		)
		.merge
		(
			(evaluations: RDatum<PermissionParameterEvaluation>) =>
			(
				{
					authorised: RethinkDB.and
					(
						evaluations('granted').eq(true),
						evaluations('negated').eq(false)
					)
				}
			)
		);
	return query;
};